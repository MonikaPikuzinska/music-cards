import { QueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getUsersByGameId } from "../api/api";
import { IUser } from "../api/interface";
import { isLoggedIn } from "./isLoggedIn";
import { toBool } from "./toBool";
import { normalizeUser } from "./normalizeUser";
import { parseSongHand } from "./songHand";

type UsersRow = Record<string, unknown>;

const refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** Ignore is_logged:false for this long after join (stale logout / race). */
const JOIN_GRACE_MS = 30_000;
const recentJoins = new Map<string, number>();

export function usersQueryKey(gameId: string) {
  return ["users", gameId] as const;
}

export function markRecentJoin(userId: string): void {
  recentJoins.set(String(userId), Date.now());
}

function shouldIgnoreLogout(userId: string): boolean {
  const joinedAt = recentJoins.get(String(userId));
  if (joinedAt == null) return false;
  return Date.now() - joinedAt < JOIN_GRACE_MS;
}

function rowBelongsToGame(
  row: UsersRow | null | undefined,
  gameId: string,
): boolean {
  return row != null && String(row.game_id ?? "") === String(gameId);
}

function isExplicitlyLoggedOut(row: UsersRow | null | undefined): boolean {
  return row?.is_logged === false || row?.is_logged === "false";
}

function isExplicitlyLoggedIn(row: UsersRow | null | undefined): boolean {
  return row?.is_logged === true || row?.is_logged === "true";
}

function hasVoteFieldUpdate(row: UsersRow | null | undefined): boolean {
  if (!row) return false;
  return (
    row.my_song_voted !== undefined ||
    row.master_song_voted !== undefined ||
    row.my_song_id !== undefined ||
    row.master_song_id !== undefined ||
    row.song_hand !== undefined ||
    row.points !== undefined
  );
}

function handKey(user: IUser): string {
  return [...parseSongHand(user.song_hand)].sort().join("|");
}

/** Last-round hands and song ids, so a late poll cannot restore them. */
type LastRoundSnap = {
  hand: string;
  my_song_id: string;
  master_song_id: string;
};

const lastRoundByUser = new Map<string, LastRoundSnap>();

export function snapshotUsersForRoundReset(users: IUser[]): void {
  lastRoundByUser.clear();
  for (const u of users) {
    lastRoundByUser.set(String(u.id), {
      hand: handKey(u),
      my_song_id: (u.my_song_id || "").trim(),
      master_song_id: (u.master_song_id || "").trim(),
    });
  }
}

export function isStaleLastRoundUser(
  user: IUser | null | undefined,
): boolean {
  if (!user) return false;
  const snap = lastRoundByUser.get(String(user.id));
  if (!snap) return false;
  const hand = handKey(user);
  return hand.length > 0 && hand === snap.hand;
}

function pickThisRoundSongId(
  userId: string,
  prevId: string | undefined,
  freshId: string | undefined,
  field: "my_song_id" | "master_song_id",
): string {
  const fresh = (freshId || "").trim();
  const prev = (prevId || "").trim();
  const stale = (lastRoundByUser.get(String(userId))?.[field] || "").trim();

  if (fresh) {
    if (stale && fresh === stale && !prev) return "";
    return fresh;
  }
  if (stale && prev === stale) return "";
  return prev;
}

function hasClearedRoundPicks(user: IUser): boolean {
  return (
    !toBool(user.my_song_voted) &&
    !toBool(user.master_song_voted) &&
    !(user.my_song_id || "").trim() &&
    !(user.master_song_id || "").trim()
  );
}

function isFreshRoundReset(user: IUser): boolean {
  return (
    user.song_hand != null &&
    parseSongHand(user.song_hand).length === 0 &&
    hasClearedRoundPicks(user)
  );
}

const CLEARED_ROUND_PICKS: Pick<
  IUser,
  "my_song_voted" | "master_song_voted" | "my_song_id" | "master_song_id"
> = {
  my_song_voted: false,
  master_song_voted: false,
  my_song_id: "",
  master_song_id: "",
};

function mergeVoteFields(prevU: IUser, freshU: IUser): IUser {
  const points = !isLoggedIn(freshU)
    ? 0
    : Number.isFinite(Number(freshU.points))
      ? Number(freshU.points)
      : Number(prevU.points) || 0;

  if (isFreshRoundReset(freshU) || isStaleLastRoundUser(freshU)) {
    return normalizeUser({
      ...(isFreshRoundReset(freshU) ? freshU : prevU),
      points,
      ...CLEARED_ROUND_PICKS,
      song_hand: isFreshRoundReset(freshU)
        ? []
        : parseSongHand(prevU.song_hand),
    });
  }

  const prevHand = parseSongHand(prevU.song_hand);
  const freshHand = parseSongHand(freshU.song_hand);
  const song_hand = freshHand.length > 0 ? freshHand : prevHand;
  const userId = String(freshU.id ?? prevU.id);
  const my_song_id = pickThisRoundSongId(
    userId,
    prevU.my_song_id,
    freshU.my_song_id,
    "my_song_id",
  );
  const master_song_id = pickThisRoundSongId(
    userId,
    prevU.master_song_id,
    freshU.master_song_id,
    "master_song_id",
  );

  return normalizeUser({
    ...freshU,
    points,
    my_song_id,
    master_song_id,
    my_song_voted: my_song_id.length > 0 && (toBool(prevU.my_song_voted) || toBool(freshU.my_song_voted)),
    master_song_voted:
      master_song_id.length > 0 &&
      (toBool(prevU.master_song_voted) || toBool(freshU.master_song_voted)),
    song_hand,
  });
}

/** Merge DB rows with cache — never drop online players missing from a stale fetch. */
export function mergeUsersLists(prev: IUser[], fresh: IUser[]): IUser[] {
  const byId = new Map<string, IUser>();

  for (const u of fresh) {
    const id = String(u.id);
    const prevU = prev.find((p) => String(p.id) === id);
    let row = prevU ? mergeVoteFields(prevU, u) : normalizeUser(u);

    if (
      prevU &&
      isLoggedIn(prevU) &&
      !isLoggedIn(row) &&
      shouldIgnoreLogout(id)
    ) {
      row = normalizeUser({ ...row, is_logged: true });
    }

    byId.set(id, row);
  }

  for (const u of prev) {
    const id = String(u.id);
    if (byId.has(id)) continue;
    if (isLoggedIn(u)) {
      byId.set(id, normalizeUser(u));
    }
  }

  return Array.from(byId.values());
}

/** Merge server list into React Query cache. */
export function setMergedUsersList(
  queryClient: QueryClient,
  gameId: string,
  fresh: IUser[],
): void {
  queryClient.setQueryData<IUser[]>(usersQueryKey(gameId), (prev = []) =>
    mergeUsersLists(prev, fresh),
  );
}

export async function refreshUsersForGame(
  queryClient: QueryClient,
  gameId: string,
): Promise<void> {
  if (!gameId) return;
  const fresh = await getUsersByGameId(gameId);
  setMergedUsersList(queryClient, gameId, fresh);
}

/** Apply a successful vote/selection update to the local players cache immediately. */
export function patchUserInCache(
  queryClient: QueryClient,
  gameId: string,
  userId: string,
  patch: Partial<IUser>,
): void {
  const idStr = String(userId);
  queryClient.setQueryData<IUser[]>(usersQueryKey(gameId), (prev = []) => {
    const idx = prev.findIndex((u) => String(u.id) === idStr);
    if (idx < 0) return prev;
    const next = [...prev];
    const prevUser = prev[idx];
    const nextPatch: Partial<IUser> = { ...patch };
    const patchClearsHand =
      Object.prototype.hasOwnProperty.call(patch, "song_hand") &&
      parseSongHand(patch.song_hand).length === 0;
    const patchIsNewPick =
      (typeof patch.my_song_id === "string" && patch.my_song_id.trim().length > 0) ||
      toBool(patch.my_song_voted) ||
      (typeof patch.master_song_id === "string" &&
        patch.master_song_id.trim().length > 0) ||
      toBool(patch.master_song_voted);
    if (patchClearsHand && patchIsNewPick && parseSongHand(prevUser.song_hand).length > 0) {
      delete nextPatch.song_hand;
    }
    next[idx] = normalizeUser({ ...prevUser, ...nextPatch });
    return next;
  });
}

export function scheduleUsersQueryRefresh(
  queryClient: QueryClient,
  gameId: string,
  delayMs = 800,
): void {
  if (!gameId) return;

  const existing = refreshTimers.get(gameId);
  if (existing) clearTimeout(existing);

  refreshTimers.set(
    gameId,
    setTimeout(() => {
      refreshTimers.delete(gameId);
      void refreshUsersForGame(queryClient, gameId);
    }, delayMs),
  );
}

export function applyUsersRealtimeToCache(
  queryClient: QueryClient,
  gameId: string,
  payload: RealtimePostgresChangesPayload<UsersRow>,
): void {
  const newRow = payload.new as UsersRow | null;
  const oldRow = payload.old as UsersRow | null;
  const userId = newRow?.id ?? oldRow?.id;
  if (userId == null) return;

  const idStr = String(userId);
  const belongsToGame =
    rowBelongsToGame(newRow, gameId) || rowBelongsToGame(oldRow, gameId);

  queryClient.setQueryData<IUser[]>(usersQueryKey(gameId), (prev = []) => {
    const idx = prev.findIndex((u) => String(u.id) === idStr);
    const inList = idx >= 0;

    if (!belongsToGame && !inList) return prev;

    if (payload.eventType === "INSERT" || isExplicitlyLoggedIn(newRow)) {
      markRecentJoin(idStr);
    }

    if (payload.eventType === "DELETE") {
      return prev.filter((u) => String(u.id) !== idStr);
    }

    if (isExplicitlyLoggedOut(newRow)) {
      if (shouldIgnoreLogout(idStr)) return prev;
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = normalizeUser({
          ...prev[idx],
          is_logged: false,
          points: 0,
        });
        return next;
      }
      return prev;
    }

    const sourceRow =
      newRow ??
      (idx >= 0 ? ({ ...prev[idx], id: userId } as UsersRow) : oldRow);
    if (!sourceRow) return prev;

    const merged =
      idx >= 0
        ? mergeVoteFields(
            prev[idx],
            normalizeUser({
              ...prev[idx],
              ...(newRow as Partial<IUser> | null),
            }),
          )
        : normalizeUser(sourceRow as unknown as IUser);
    let normalized = merged;

    if (isExplicitlyLoggedIn(newRow) || payload.eventType === "INSERT") {
      markRecentJoin(idStr);
      if (!isLoggedIn(normalized)) {
        normalized = normalizeUser({ ...normalized, is_logged: true });
      }
    }

    if (idx < 0) {
      return [...prev, normalized];
    }

    const next = [...prev];
    next[idx] = normalized;
    return next;
  });

  if (
    payload.eventType === "INSERT" ||
    payload.eventType === "DELETE" ||
    (payload.eventType === "UPDATE" &&
      (isExplicitlyLoggedIn(newRow) || hasVoteFieldUpdate(newRow)))
  ) {
    scheduleUsersQueryRefresh(queryClient, gameId);
  }
}
