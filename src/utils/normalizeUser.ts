import { IUser } from "../api/interface";
import { toBool } from "./toBool";
import { isLoggedIn } from "./isLoggedIn";
import { parseSongHand } from "./songHand";

export function normalizeUser(user: IUser): IUser {
  return {
    ...user,
    my_song_voted: toBool(user.my_song_voted),
    master_song_voted: toBool(user.master_song_voted),
    is_logged: isLoggedIn(user),
    song_hand: parseSongHand(user.song_hand),
  };
}
