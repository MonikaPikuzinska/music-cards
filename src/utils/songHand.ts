import { toBool } from "./toBool";
import { IUser } from "../api/interface";
import { HAND_SIZE } from "../constants/game";

export function parseSongHand(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((id) => String(id).trim()).filter(Boolean);
  }
  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return parseSongHand(parsed);
    } catch {
      return [];
    }
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((part) => part.replace(/^"+|"+$/g, "").trim())
      .filter(Boolean);
  }

  return trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function songHandSaveErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (/schema cache|could not find the ['"]?song_hand/i.test(message)) {
    return "Your users.song_hand column exists, but Supabase’s API cache has not loaded it yet. In the SQL Editor run: NOTIFY pgrst, 'reload schema'; then refresh the game.";
  }
  if (/does not exist|could not find.*column/i.test(message) && /song_hand/i.test(message)) {
    return "Could not save your song list. Add a song_hand text[] column on users in Supabase, run NOTIFY pgrst, 'reload schema'; then refresh.";
  }
  if (message.trim()) {
    return `Could not save your song list. ${message}`;
  }
  return "Could not save your song list. Try refreshing.";
}

export function usedSongIdsFromUsers(
  users: IUser[],
  exceptUserId?: string | null,
): Set<string> {
  const used = new Set<string>();
  for (const u of users) {
    if (exceptUserId != null && String(u.id) === String(exceptUserId)) continue;
    for (const id of parseSongHand(u.song_hand)) {
      used.add(id);
    }
  }
  return used;
}

export function pickUniqueHand(
  pool: Array<{ id?: string }>,
  usedIds: Set<string>,
  size = HAND_SIZE,
): string[] {
  const hand: string[] = [];
  const seen = new Set(usedIds);
  for (const track of pool) {
    const id = track.id?.trim() ?? "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    hand.push(id);
    if (hand.length >= size) break;
  }
  return hand;
}

export function handsAreUnique(users: IUser[]): boolean {
  const seen = new Set<string>();
  for (const u of users) {
    for (const id of parseSongHand(u.song_hand)) {
      if (seen.has(id)) return false;
      seen.add(id);
    }
  }
  return true;
}

/** Master finished picking only when the chosen song is in this round’s 6-song hand. */
export function masterPickedFromHand(
  master:
    | Pick<IUser, "my_song_id" | "my_song_voted" | "song_hand">
    | null
    | undefined,
  handSize = HAND_SIZE,
): boolean {
  if (!master) return false;
  const pick = (master.my_song_id || "").trim();
  if (!toBool(master.my_song_voted) || !pick) return false;
  const hand = parseSongHand(master.song_hand);
  return hand.length >= handSize && hand.includes(pick);
}

/** True if the Master has a saved pick that does not belong to a newer dealt hand. */
export function masterHasSubmittedPick(
  master:
    | Pick<IUser, "my_song_id" | "my_song_voted" | "song_hand">
    | null
    | undefined,
  handSize = HAND_SIZE,
): boolean {
  if (!master) return false;
  const pick = (master.my_song_id || "").trim();
  if (!toBool(master.my_song_voted) || !pick) return false;
  const hand = parseSongHand(master.song_hand);
  if (hand.length >= handSize && !hand.includes(pick)) return false;
  return true;
}
