import { supabase, supabaseUrl } from "../supabase-client";
import { normalizeUser } from "../utils/normalizeUser";
import { parseSongHand } from "../utils/songHand";
import { gameReflectsUpdates } from "../utils/gameUpdate";
import { GameState, IGame, IUser } from "./interface";

export const createGame = async (game: IGame) => {
  const { data, error } = await supabase.from("games").insert(game);

  if (error) throw new Error(error.message);

  return data;
};
export const createUser = async (user: IUser) => {
  const { data, error } = await supabase.from("users").insert(user);

  if (error) throw new Error(error.message);

  return data;
};

function songHandWriteValues(ids: string[]): unknown[] {
  const pgLiteral =
    ids.length === 0
      ? "{}"
      : `{${ids.map((id) => `"${id.replace(/"/g, "")}"`).join(",")}}`;
  return [ids, JSON.stringify(ids), pgLiteral];
}

function userUpdateAttempts(updates: Partial<IUser>): Record<string, unknown>[] {
  if (!Object.prototype.hasOwnProperty.call(updates, "song_hand")) {
    return [updates as Record<string, unknown>];
  }
  const ids = parseSongHand(updates.song_hand);
  const rest: Record<string, unknown> = { ...updates };
  delete rest.song_hand;
  return songHandWriteValues(ids).map((song_hand) => ({ ...rest, song_hand }));
}

export const updateUser = async (userId: string, updates: Partial<IUser>) => {
  let lastMessage = "Failed to update user";

  for (const payload of userUpdateAttempts(updates)) {
    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", userId)
      .select();

    if (!error) return data;
    lastMessage = error.message;
  }

  throw new Error(lastMessage);
};

export const LOGOUT_USER_RESET = {
  is_logged: false,
  points: 0,
} as const;

export const markUserLoggedOut = async (userId: string) => {
  const { error } = await supabase
    .from("users")
    .update({ ...LOGOUT_USER_RESET })
    .eq("id", userId);

  if (error) throw new Error(error.message);
};

/** Runs during tab close; fetch keepalive survives page unload. */
export function markUserLoggedOutKeepalive(userId: string): void {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  if (!anonKey || !supabaseUrl) return;

  const url = `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`;
  const body = JSON.stringify({ ...LOGOUT_USER_RESET });
  const baseHeaders = {
    apikey: anonKey,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };

  void fetch(url, {
    method: "PATCH",
    headers: { ...baseHeaders, Authorization: `Bearer ${anonKey}` },
    body,
    keepalive: true,
  });

  void supabase.auth.getSession().then(({ data: { session } }) => {
    const token = session?.access_token;
    if (!token) return;
    void fetch(url, {
      method: "PATCH",
      headers: { ...baseHeaders, Authorization: `Bearer ${token}` },
      body,
      keepalive: true,
    });
  });
}

export const markUserLoggedIn = async (userId: string) => {
  const { error } = await supabase
    .from("users")
    .update({ is_logged: true })
    .eq("id", userId);

  if (error) throw new Error(error.message);
};

export const createGameBoardDB = async (userData: IUser) => {
  await createGame({
    id: userData.game_id,
    game_number: 1,
    master_id: userData.id,
    state: GameState.MASTER_SELECTS,
  }).then(async () => {
    // check if user with this id already exists in 'users' table
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userData.id)
      .maybeSingle();

    if (fetchError) {
      // if fetching failed, rethrow to let caller handle it
      throw fetchError;
    }

    if (!existingUser) {
      // only create the user if they don't already exist
      await createUser(userData);
    } else {
      // if user exists, update selected fields to join the new game
      await updateUser(String(userData.id), {
        game_id: userData.game_id,
        avatar: userData.avatar,
        my_song_voted: userData.my_song_voted,
        master_song_voted: userData.master_song_voted,
        points: userData.points,
        my_song_id: userData.my_song_id,
        master_song_id: userData.master_song_id,
        is_logged: userData.is_logged,
        song_hand: userData.song_hand ?? [],
      });
    }
  });
};

export async function getGameById(gameId: string) {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function getUsersByGameId(gameId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("game_id", gameId);

  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => normalizeUser(row as IUser));
}

const UNKNOWN_COLUMN = /clue|scores_applied/i;

function stripOptionalGameColumns(updates: Partial<IGame>): Partial<IGame> {
  const next = { ...updates };
  delete next.clue;
  delete next.scores_applied;
  return next;
}

export async function updateGame(
  gameId: string,
  updates: Partial<IGame>,
  match: Partial<IGame> = {},
) {
  const write = async (payload: Partial<IGame>) => {
    let query = supabase.from("games").update(payload).eq("id", gameId);
    if (match.state != null) {
      query = query.eq("state", match.state);
    }
    if (match.game_number != null) {
      query = query.eq("game_number", match.game_number);
    }
    return query.select();
  };

  let payload = updates;
  let { data, error } = await write(payload);

  if (error && UNKNOWN_COLUMN.test(error.message)) {
    payload = stripOptionalGameColumns(updates);
    const retried = await write(payload);
    data = retried.data;
    error = retried.error;
  }

  if (error) throw new Error(error.message);

  if (data && data.length > 0 && gameReflectsUpdates(data[0] as IGame, payload)) {
    return data as IGame[];
  }

  // RLS may hide RETURNING. Re-read and only treat it as a win if the write landed.
  const { data: fetched, error: fetchError } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (fetched && gameReflectsUpdates(fetched as IGame, payload)) {
    return [fetched as IGame];
  }
  return [];
}

function asGameRow(value: unknown): IGame | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as IGame | undefined) ?? null;
  return value as IGame;
}

async function patchGameRest(
  gameId: string,
  body: Record<string, unknown>,
): Promise<IGame | null> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  if (!supabaseUrl || !anonKey) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token || anonKey;
  const url = `${supabaseUrl}/rest/v1/games?id=eq.${encodeURIComponent(gameId)}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  try {
    return asGameRow(await res.json());
  } catch {
    return null;
  }
}

/** Writes the next Master to games.master_id and re-reads until it is stored. */
export async function saveNextRoundGame(params: {
  gameId: string;
  masterId: string;
  gameNumber: number;
}): Promise<IGame | null> {
  const gameId = String(params.gameId);
  const masterId = String(params.masterId);
  const gameNumber = Number(params.gameNumber);
  const core = {
    state: GameState.MASTER_SELECTS,
    master_id: masterId,
    game_number: gameNumber,
  };

  const readIfSaved = async (row: IGame | null | undefined) => {
    if (row && String(row.master_id) === masterId) return row;
    const latest = await getGameById(gameId).catch(() => null);
    if (latest && String(latest.master_id) === masterId) return latest;
    return null;
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "start_next_round",
    {
      p_game_id: gameId,
      p_master_id: masterId,
      p_game_number: gameNumber,
    },
  );
  if (!rpcError) {
    const saved = await readIfSaved(asGameRow(rpcData));
    if (saved) return saved;
  }

  try {
    const rows = await updateGame(gameId, core);
    const saved = await readIfSaved(rows[0]);
    if (saved) return saved;
  } catch (err) {
    console.error("saveNextRoundGame table update failed", err);
  }

  const patched = await patchGameRest(gameId, core);
  const fromPatch = await readIfSaved(patched);
  if (fromPatch) return fromPatch;

  try {
    const rows = await updateGame(gameId, { master_id: masterId });
    const saved = await readIfSaved(rows[0]);
    if (saved) {
      try {
        await updateGame(gameId, {
          state: GameState.MASTER_SELECTS,
          game_number: gameNumber,
          master_id: masterId,
        });
      } catch (err) {
        console.error("saveNextRoundGame follow-up state update failed", err);
      }
      return (await getGameById(gameId).catch(() => null)) ?? saved;
    }
  } catch (err) {
    console.error("saveNextRoundGame master_id-only update failed", err);
  }

  const masterOnly = await patchGameRest(gameId, { master_id: masterId });
  const fromMasterOnly = await readIfSaved(masterOnly);
  if (fromMasterOnly) return fromMasterOnly;

  return readIfSaved(null);
}
