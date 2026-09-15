import { QueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getUsersByGameId } from "../api/api";
import { IUser } from "../api/interface";
import { isLoggedIn } from "./isLoggedIn";
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
    row.song_hand !== undefined
  );
}

function mergeVoteFields(prevU: IUser, freshU: IUser): IUser {
  const pickSongId = (a: string, b: string) => {
    const ta = a?.trim() ?? "";
    const tb = b?.trim() ?? "";
    return tb.length > 0 ? tb : ta;
  };

  return normalizeUser({
    ...freshU,
    my_song_voted: prevU.my_song_voted || freshU.my_song_voted,
    master_song_voted: prevU.master_song_voted || freshU.master_song_voted,
    my_song_id: pickSongId(prevU.my_song_id, freshU.my_song_id),
    master_song_id: pickSongId(prevU.master_song_id, freshU.master_song_id),
    song_hand:
      parseSongHand(freshU.song_hand).length > 0
        ? parseSongHand(freshU.song_hand)
        : parseSongHand(prevU.song_hand),
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
    next[idx] = normalizeUser({ ...prev[idx], ...patch });
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
        next[idx] = normalizeUser({ ...prev[idx], is_logged: false });
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
        ? { ...prev[idx], ...(newRow as Partial<IUser> | null) }
        : (sourceRow as unknown as IUser);
    let normalized = normalizeUser(merged);

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
