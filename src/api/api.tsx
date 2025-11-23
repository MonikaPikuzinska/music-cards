import { supabase } from "../supabase-client";
import { IGame, IUser } from "./interface";

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
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select();

  if (error) throw new Error(error.message);
  return data;
};

export const createGameBoardDB = async (userData: IUser) => {
  await createGame({
    id: userData.game_id,
    game_number: 1,
    master_id: userData.id,
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
        voted: userData.voted,
        points: userData.points,
        song_id: userData.song_id,
        is_logged: userData.is_logged,
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
  return data;
}
