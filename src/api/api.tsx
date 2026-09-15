import { supabase, supabaseUrl } from "../supabase-client";
import { normalizeUser } from "../utils/normalizeUser";
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

export const updateUser = async (userId: string, updates: Partial<IUser>) => {
  let { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select();

  if (error && /song_hand/i.test(error.message)) {
    const stripped = { ...updates };
    delete stripped.song_hand;
    const retried = await supabase
      .from("users")
      .update(stripped)
      .eq("id", userId)
      .select();
    data = retried.data;
    error = retried.error;
  }

  if (error) throw new Error(error.message);
  return data;
};

export const markUserLoggedOut = async (userId: string) => {
  const { error } = await supabase
    .from("users")
    .update({ is_logged: false })
    .eq("id", userId);

  if (error) throw new Error(error.message);
};

/** Runs during tab close; fetch keepalive survives page unload. */
export function markUserLoggedOutKeepalive(userId: string): void {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  if (!anonKey || !supabaseUrl) return;

  const url = `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`;
  const body = JSON.stringify({ is_logged: false });
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
  let query = supabase.from("games").update(updates).eq("id", gameId);
  if (match.state != null) {
    query = query.eq("state", match.state);
  }

  let { data, error } = await query.select();

  if (error && UNKNOWN_COLUMN.test(error.message)) {
    const stripped = stripOptionalGameColumns(updates);
    let retry = supabase.from("games").update(stripped).eq("id", gameId);
    if (match.state != null) {
      retry = retry.eq("state", match.state);
    }
    const retried = await retry.select();
    data = retried.data;
    error = retried.error;
  }

  if (error) throw new Error(error.message);
  if (data && data.length > 0) return data as IGame[];

  // Matched updates that return no rows either matched 0 records or RLS hid them.
  // Let the caller re-read the row instead of treating this as a win.
  if (match.state != null) return [];

  const { data: fetched, error: fetchError } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  return fetched ? [fetched as IGame] : [];
}
