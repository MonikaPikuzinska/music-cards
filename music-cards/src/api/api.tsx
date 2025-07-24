import { UUIDTypes } from "uuid";
import { supabase } from "../supabase-client";
import { IGame, IUser } from "./interface";

export const createSession = async (id: UUIDTypes) => {
  const { data, error } = await supabase.from("sessions").insert({ id });

  if (error) throw new Error(error.message);

  return data;
};
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
