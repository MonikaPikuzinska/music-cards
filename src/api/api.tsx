import { UUIDTypes } from "uuid";
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
    .eq("id", userId);

  if (error) throw new Error(error.message);
  return data;
};

export const createGameBoardDB = async (userData: IUser) => {
  await createGame({
    id: userData.game_id,
    game_number: 1,
    master_id: userData.id,
  }).then(async () => {
    await createUser(userData);
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
