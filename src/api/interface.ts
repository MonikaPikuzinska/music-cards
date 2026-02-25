import { UUIDTypes } from "uuid";

export interface IGame {
  id: UUIDTypes;
  game_number: number;
  master_id: UUIDTypes;
}

export interface IUser {
  id: UUIDTypes;
  game_id: UUIDTypes;
  name: string;
  avatar: string;
  my_song_voted: boolean;
  master_song_voted: boolean;
  points: number;
  my_song_id: string;
  master_song_id: string;
  is_logged: boolean;
}
