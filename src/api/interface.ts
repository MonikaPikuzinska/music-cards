import { UUIDTypes } from "uuid";

export interface IGame {
  id: UUIDTypes;
  session_id: UUIDTypes;
  game_number: number;
  master_id: UUIDTypes;
}

export interface IUser {
  id: UUIDTypes;
  game_id: UUIDTypes;
  session_id: UUIDTypes;
  name: string;
  avatar: string;
  voted: boolean;
  points: number;
  song_id: string;
  is_logged: boolean;
}
