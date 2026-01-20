import { v4 as uuid, UUIDTypes } from "uuid";
import {
  createUser,
  getUsersByGameId,
  updateUser,
} from "../api/api";
import { supabase } from "../supabase-client";
import getRandomAvatar from "../utils/getRandomAvatar";
import { IUser } from "../api/interface";

interface HandleUserJoinGameParams {
  id: UUIDTypes | string;
  user: any;
  setUsersList: (users: IUser[]) => void;
  setIsUserCreated: (created: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
  setCurrentUser: (user: IUser | null) => void;
}

export const handleUserJoinGame = async ({
  id,
  user,
  setUsersList,
  setIsUserCreated,
  setErrorMessage,
  setCurrentUser,
}: HandleUserJoinGameParams) => {
  try {
    const users: IUser[] = await getUsersByGameId(id.toString());
    setUsersList(users);

    // Check for max players first
    if (users.length >= 6) {
      setIsUserCreated(true);
      setErrorMessage("Too many players");
      return;
    }

    // Check if current user already exists globally (by supabase id)
    const currentUserName =
      user.user_metadata?.full_name || user.user_metadata?.name || "";

    // First check if a user with this supabase id exists anywhere in the table
    const { data: existingUserGlobal, error: existingFetchErr } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (existingFetchErr) {
      setErrorMessage("Error checking existing user");
      return;
    }

    if (existingUserGlobal) {
      // If the user exists but may belong to another game, update the row to join this game
      try {
        await updateUser(String(user.id), {
          game_id: id,
          avatar: existingUserGlobal.avatar || (user ? uuid() : ""),
          voted: false,
          points: existingUserGlobal.points ?? 0,
          song_id: "",
          is_logged: true,
        });
        const merged = { ...existingUserGlobal, game_id: id, is_logged: true };
        setCurrentUser(merged);
        setIsUserCreated(true);
        return;
      } catch (err) {
        setErrorMessage("Error updating existing user");
        return;
      }
    }

    // If no global existing user, check by name among current game's users
    const userExistsByName = users.find((u) => u.name === currentUserName);
    const userExists = userExistsByName;

    if (!userExists) {
      try {
        const newUser = {
          id: user.id,
          game_id: users[0]?.game_id,
          name: currentUserName || uuid(),
          avatar: user
            ? getRandomAvatar(users.map((u) => u.avatar)).iconName
            : "",
          voted: false,
          points: 0,
          song_id: "",
          is_logged: true,
        };
        setCurrentUser(newUser);
        await createUser(newUser);
        setIsUserCreated(true);
      } catch {
        setIsUserCreated(false);
        setErrorMessage("Error creating user");
      }
    } else {
      setCurrentUser(userExists);
      setIsUserCreated(true);
    }
  } catch (err) {
    setErrorMessage("Error fetching users");
  }
};
