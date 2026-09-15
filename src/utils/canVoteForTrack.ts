/** Players cannot vote for the song they submitted. */
export function canVoteForTrack(
  trackId: string | null | undefined,
  ownSongId: string | null | undefined,
): boolean {
  const track = trackId?.trim() ?? "";
  const own = ownSongId?.trim() ?? "";
  if (!track) return false;
  if (!own) return true;
  return track !== own;
}

export function randomTrackIdFromPool(
  pool: Array<{ id?: string }>,
  excludeId?: string | null,
): string {
  const ids = pool
    .map((t) => t.id?.trim() ?? "")
    .filter((id) => id.length > 0 && canVoteForTrack(id, excludeId));
  const usable = ids.length > 0 ? ids : pool.map((t) => t.id?.trim() ?? "").filter(Boolean);
  if (usable.length === 0) return "";
  return usable[Math.floor(Math.random() * usable.length)] ?? "";
}
