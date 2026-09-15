import { IUser } from "../api/interface";

export type ScoreableUser = Pick<
  IUser,
  "id" | "my_song_id" | "master_song_id"
>;

const idOf = (value: { id: unknown } | string): string =>
  typeof value === "string" ? value : String(value.id);

const songId = (value: string | null | undefined): string =>
  typeof value === "string" ? value.trim() : "";

/**
 * Points earned this round (not cumulative totals).
 *
 * If some but not all non-Master players guessed the Master's song:
 *   Master +3, each correct guesser +3, +1 per vote on your own song.
 * If everyone or no one guessed:
 *   Master 0, every other player +2 (no vote bonuses).
 */
export function calculateRoundScores(
  users: ScoreableUser[],
  masterId: string,
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const u of users) {
    scores[idOf(u)] = 0;
  }

  const master = users.find((u) => idOf(u) === String(masterId));
  if (!master || users.length === 0) return scores;

  const masterSong = songId(master.my_song_id);
  const others = users.filter((u) => idOf(u) !== String(masterId));

  if (others.length === 0) return scores;

  const guessedCorrectly = (u: ScoreableUser) =>
    masterSong.length > 0 && songId(u.master_song_id) === masterSong;

  const correctGuessers = others.filter(guessedCorrectly);
  const allGuessed = correctGuessers.length === others.length;
  const noneGuessed = correctGuessers.length === 0;

  if (allGuessed || noneGuessed) {
    scores[idOf(master)] = 0;
    for (const u of others) {
      scores[idOf(u)] = 2;
    }
    return scores;
  }

  scores[idOf(master)] = 3;
  for (const u of correctGuessers) {
    scores[idOf(u)] += 3;
  }

  for (const owner of others) {
    const owned = songId(owner.my_song_id);
    if (!owned) continue;
    const votesOnOwn = others.filter(
      (voter) =>
        idOf(voter) !== idOf(owner) && songId(voter.master_song_id) === owned,
    ).length;
    scores[idOf(owner)] += votesOnOwn;
  }

  return scores;
}

export function scoreDeltasAsList(
  users: ScoreableUser[],
  masterId: string,
): Array<{ userId: string; points: number }> {
  const scores = calculateRoundScores(users, masterId);
  return Object.entries(scores).map(([userId, points]) => ({ userId, points }));
}
