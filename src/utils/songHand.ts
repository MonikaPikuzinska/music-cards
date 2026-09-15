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
