import { GameState, IGame, IUser } from "../api/interface";
import { getUsersByGameId, updateGame, updateUser } from "../api/api";
import { calculateRoundScores } from "../utils/scoring";
import { getNextMaster } from "../utils/nextMaster";
import { randomTrackIdFromPool } from "../utils/canVoteForTrack";

export async function applyRoundScores(users: IUser[], masterId: string) {
  const deltas = calculateRoundScores(users, String(masterId));
  await Promise.all(
    users.map((u) => {
      const add = deltas[String(u.id)] ?? 0;
      if (add === 0) return Promise.resolve();
      return updateUser(String(u.id), { points: (u.points || 0) + add });
    }),
  );
}

async function assignMissingVotes(
  users: IUser[],
  masterId: string,
  votePool: Array<{ id?: string }>,
): Promise<IUser[]> {
  if (votePool.length === 0) return users;

  const assigned = new Map<string, IUser>();
  for (const u of users) {
    assigned.set(String(u.id), u);
  }

  const missing = users.filter(
    (u) =>
      String(u.id) !== String(masterId) &&
      (typeof u.master_song_id !== "string" ||
        u.master_song_id.trim().length === 0),
  );

  await Promise.all(
    missing.map(async (u) => {
      const pick = randomTrackIdFromPool(votePool, u.my_song_id);
      if (!pick) return;
      await updateUser(String(u.id), {
        master_song_id: pick,
        master_song_voted: true,
      });
      assigned.set(String(u.id), {
        ...u,
        master_song_id: pick,
        master_song_voted: true,
      });
    }),
  );

  return Array.from(assigned.values());
}

/** One client wins the USERS_VOTE → FINAL lock, then writes scores once. */
export async function finalizeVoteRound(params: {
  gameId: string;
  masterId: string;
  votePool?: Array<{ id?: string }>;
}): Promise<IGame | null> {
  const { gameId, masterId, votePool = [] } = params;

  const won = await updateGame(
    gameId,
    { state: GameState.FINAL, scores_applied: true },
    { state: GameState.USERS_VOTE },
  );
  if (won.length === 0) return null;

  let users = await getUsersByGameId(gameId);
  users = await assignMissingVotes(users, masterId, votePool);
  await applyRoundScores(users, masterId);
  return won[0];
}

const ROUND_RESET: Partial<IUser> = {
  my_song_voted: false,
  master_song_voted: false,
  my_song_id: "",
  master_song_id: "",
  song_hand: [],
};

export async function startNextRound(params: {
  gameId: string;
  users: IUser[];
  currentMasterId: string;
  gameNumber: number;
}): Promise<IGame | null> {
  const { gameId, users, currentMasterId, gameNumber } = params;
  const nextMaster = getNextMaster(users, currentMasterId);
  if (!nextMaster) return null;

  const won = await updateGame(
    gameId,
    {
      state: GameState.MASTER_SELECTS,
      master_id: nextMaster.id,
      clue: "",
      scores_applied: false,
      game_number: (gameNumber || 1) + 1,
      timer_started_at: null,
    },
    { state: GameState.FINAL },
  );

  if (won.length === 0) return null;

  await Promise.all(users.map((u) => updateUser(String(u.id), ROUND_RESET)));

  return {
    ...won[0],
    master_id: nextMaster.id,
    state: GameState.MASTER_SELECTS,
    clue: "",
    scores_applied: false,
  };
}
