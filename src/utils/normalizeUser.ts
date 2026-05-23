import { IUser } from "../api/interface";
import { toBool } from "./toBool";
import { isLoggedIn } from "./isLoggedIn";

export function normalizeUser(user: IUser): IUser {
  return {
    ...user,
    my_song_voted: toBool(user.my_song_voted),
    master_song_voted: toBool(user.master_song_voted),
    is_logged: isLoggedIn(user),
  };
}
