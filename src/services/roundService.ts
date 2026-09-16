import { GameState, IGame, IUser } from "../api/interface";
import { getGameById, getUsersByGameId, saveNextRoundGame, updateGame, updateUser } from "../api/api";
import { calculateRoundScores } from "../utils/scoring";
import { getNextMaster } from "../utils/nextMaster";
import { randomTrackIdFromPool } from "../utils/canVoteForTrack";
import { toBool } from "../utils/toBool";
import { isNextRoundApplied } from "../utils/gameUpdate";

export async function applyRoundScores(users: IUser[], masterId: string) {
  const deltas = calculateRoundScores(users, String(masterId));
  await Promise.all(
    users.map((u) => {
      const add = deltas[String(u.id)] ?? 0;
      if (add === 0) return Promise.resolve();
      return updateUser(String(u.id), {
        points: (Number(u.points) || 0) + add,
      });
    }),
  );
}

function roundLooksUnscored(users: IUser[]): boolean {
  const hadSubmissions = users.some(
    (u) => typeof u.my_song_id === "string" && u.my_song_id.trim().length > 0,
  );
  const allZero = users.every((u) => (Number(u.points) || 0) === 0);
  return hadSubmissions && allZero;
}

function usersForScoring(dbUsers: IUser[], fallbackUsers: IUser[]): IUser[] {
  if (dbUsers.length === 0) return fallbackUsers;
  if (fallbackUsers.length === 0) return dbUsers;

  const dbHasSongs = dbUsers.some(
    (u) => typeof u.my_song_id === "string" && u.my_song_id.trim().length > 0,
  );
  const fallbackHasSongs = fallbackUsers.some(
    (u) => typeof u.my_song_id === "string" && u.my_song_id.trim().length > 0,
  );
  if (!dbHasSongs && fallbackHasSongs) return fallbackUsers;

  return dbUsers.map((u) => {
    const fallback = fallbackUsers.find(
      (f) => String(f.id) === String(u.id),
    );
    if (!fallback) return u;
    const pick = (a?: string, b?: string) =>
      (typeof a === "string" && a.trim()) ||
      (typeof b === "string" && b.trim()) ||
      "";
    return {
      ...u,
      my_song_id: pick(u.my_song_id, fallback.my_song_id),
      master_song_id: pick(u.master_song_id, fallback.master_song_id),
      points: Math.max(Number(u.points) || 0, Number(fallback.points) || 0),
    };
  });
}

async function persistRoundScores(
  gameId: string,
  masterId: string,
  votePool: Array<{ id?: string }> = [],
  fallbackUsers: IUser[] = [],
) {
  const fetched = await getUsersByGameId(gameId).catch(() => fallbackUsers);
  let users = usersForScoring(fetched ?? [], fallbackUsers);
  if (users.length === 0) return;

  users = await assignMissingVotes(users, masterId, votePool);
  await applyRoundScores(users, masterId);
  try {
    await updateGame(gameId, { scores_applied: true });
  } catch (err) {
    console.error("Could not mark scores_applied", err);
  }
}

/** One client wins the USERS_VOTE → FINAL lock, then writes scores once. */
export async function finalizeVoteRound(params: {
  gameId: string;
  masterId: string;
  votePool?: Array<{ id?: string }>;
  fallbackUsers?: IUser[];
}): Promise<IGame | null> {
  const { gameId, masterId, votePool = [], fallbackUsers = [] } = params;

  const existing = await getGameById(gameId);

  if (existing.state === GameState.FINAL) {
    if (existing.scores_applied !== true || roundLooksUnscored(await getUsersByGameId(gameId).catch(() => fallbackUsers))) {
      await persistRoundScores(gameId, masterId, votePool, fallbackUsers);
    }
    return { ...existing, state: GameState.FINAL, scores_applied: true };
  }
  if (existing.state !== GameState.USERS_VOTE) {
    return null;
  }

  const locked = await updateGame(
    gameId,
    { state: GameState.FINAL },
    { state: GameState.USERS_VOTE },
  );

  let latest =
    locked[0] ??
    (await getGameById(gameId).catch(() => null));

  if (latest?.state !== GameState.FINAL) {
    const forced = await updateGame(gameId, { state: GameState.FINAL });
    latest = forced[0] ?? (await getGameById(gameId));
  }

  if (!latest || latest.state !== GameState.FINAL) return null;

  if (latest.scores_applied !== true) {
    await persistRoundScores(gameId, masterId, votePool, fallbackUsers);
  } else {
    const users = await getUsersByGameId(gameId).catch(() => fallbackUsers);
    if (roundLooksUnscored(users)) {
      await persistRoundScores(gameId, masterId, votePool, fallbackUsers);
    }
  }

  return { ...latest, state: GameState.FINAL, scores_applied: true };
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

export const ROUND_PICK_RESET: Partial<IUser> = {
  my_song_voted: false,
  master_song_voted: false,
  my_song_id: "",
  master_song_id: "",
};

export const NEXT_ROUND_USER_RESET: Partial<IUser> = {
  ...ROUND_PICK_RESET,
  song_hand: [],
};

function nextRoundCore(
  nextMasterId: string,
  gameNumber: number,
): Pick<IGame, "state" | "master_id" | "game_number"> {
  return {
    state: GameState.MASTER_SELECTS,
    master_id: nextMasterId,
    game_number: (gameNumber || 1) + 1,
  };
}

function nextRoundPayload(
  nextMasterId: string,
  gameNumber: number,
): Partial<IGame> {
  return {
    ...nextRoundCore(nextMasterId, gameNumber),
    clue: "",
    scores_applied: false,
    timer_started_at: null,
  };
}

function stillHasRoundPicks(user: IUser): boolean {
  return (
    toBool(user.my_song_voted) ||
    toBool(user.master_song_voted) ||
    (user.my_song_id || "").trim().length > 0 ||
    (user.master_song_id || "").trim().length > 0
  );
}

async function clearRoundPicks(userId: string) {
  await updateUser(userId, ROUND_PICK_RESET);
}

async function resetUsersForNextRound(users: IUser[], gameId: string) {
  if (users.length === 0) return;

  await Promise.all(
    users.map(async (u) => {
      const id = String(u.id);
      try {
        await clearRoundPicks(id);
      } catch (err) {
        console.error("Failed to clear round picks for user", id, err);
      }
      try {
        await updateUser(id, { song_hand: [] });
      } catch (err) {
        console.error("Failed to clear song_hand for user", id, err);
      }
    }),
  );

  const latest = await getUsersByGameId(gameId).catch(() => []);
  await Promise.all(
    latest
      .filter(stillHasRoundPicks)
      .map((u) =>
        clearRoundPicks(String(u.id)).catch((err) =>
          console.error("Retry clear round picks failed for user", u.id, err),
        ),
      ),
  );
}

async function ensureRoundScoresApplied(
  gameId: string,
  currentMasterId: string,
  users: IUser[],
) {
  const latest = await getUsersByGameId(gameId).catch(() => users);
  const roster = usersForScoring(latest ?? [], users);
  const game = await getGameById(gameId).catch(() => null);
  if (game?.scores_applied === true && !roundLooksUnscored(roster)) return;
  await persistRoundScores(gameId, currentMasterId, [], roster);
}

function alreadyStartedNextRound(
  game: IGame | null,
  payload: Partial<IGame>,
): boolean {
  return isNextRoundApplied(game, payload);
}

function asStartedNextRound(game: IGame): IGame {
  return {
    ...game,
    state: GameState.MASTER_SELECTS,
    timer_started_at: null,
  };
}

export async function startNextRound(params: {
  gameId: string;
  users: IUser[];
  currentMasterId: string;
  gameNumber: number;
}): Promise<IGame | null> {
  const { gameId, users, currentMasterId, gameNumber } = params;
  const nextMaster =
    getNextMaster(users, currentMasterId) ??
    users.find((u) => String(u.id) === String(currentMasterId)) ??
    users[0];
  if (!nextMaster) return null;

  try {
    await ensureRoundScoresApplied(gameId, currentMasterId, users);
  } catch (err) {
    console.error("Could not apply round scores before next round", err);
  }

  const existing = await getGameById(gameId).catch(() => null);
  const fromNumber = Number(existing?.game_number ?? gameNumber ?? 1);
  const payload = nextRoundPayload(String(nextMaster.id), fromNumber);
  const nextGameNumber = Number(payload.game_number);

  let persisted = alreadyStartedNextRound(existing, payload)
    ? existing
    : await saveNextRoundGame({
        gameId,
        masterId: String(nextMaster.id),
        gameNumber: nextGameNumber,
      });

  if (!persisted || String(persisted.master_id) !== String(nextMaster.id)) {
    persisted = await getGameById(gameId).catch(() => null);
  }

  if (!persisted || String(persisted.master_id) !== String(nextMaster.id)) {
    return null;
  }

  try {
    await resetUsersForNextRound(users, gameId);
  } catch (err) {
    console.error("Could not reset players for next round", err);
  }

  try {
    await updateGame(gameId, {
      master_id: String(nextMaster.id),
      state: GameState.MASTER_SELECTS,
      game_number: nextGameNumber,
      timer_started_at: null,
      clue: "",
      scores_applied: false,
    });
  } catch (err) {
    console.error("Could not clear next-round extras", err);
  }

  const confirmed = await getGameById(gameId).catch(() => null);
  const stored =
    confirmed && String(confirmed.master_id) === String(nextMaster.id)
      ? confirmed
      : persisted;

  return asStartedNextRound({
    ...stored,
    master_id: stored.master_id,
    game_number: Number(stored.game_number) || nextGameNumber,
    state: GameState.MASTER_SELECTS,
  });
}
