import { QueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { IUser } from "../api/interface";
import { normalizeUser } from "./normalizeUser";

type UsersRow = Record<string, unknown>;

export function usersQueryKey(gameId: string) {
  return ["users", gameId] as const;
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

/** Update the players list in React Query immediately from a Supabase realtime event. */
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

    if (payload.eventType === "DELETE") {
      return prev.filter((u) => String(u.id) !== idStr);
    }

    if (isExplicitlyLoggedOut(newRow)) {
      return prev.filter((u) => String(u.id) !== idStr);
    }

    if (!newRow) return prev;

    const merged =
      idx >= 0
        ? { ...prev[idx], ...(newRow as Partial<IUser>) }
        : (newRow as unknown as IUser);
    const normalized = normalizeUser(merged);

    // New player for this game
    if (idx < 0 && rowBelongsToGame(newRow, gameId)) {
      return [...prev, normalized];
    }

    // Update existing row (incl. partial payloads without game_id)
    if (idx >= 0) {
      const next = [...prev];
      next[idx] = normalized;
      return next;
    }

    return prev;
  });
}
