import { v4 as uuid, UUIDTypes } from "uuid";
import {
  createUser,
  getUsersByGameId,
  markUserLoggedIn,
  updateUser,
} from "../api/api";
import { supabase } from "../supabase-client";
import getRandomAvatar from "../utils/getRandomAvatar";
import { IUser } from "../api/interface";
import { markRecentJoin } from "../utils/usersQueryCache";

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
  const gameId = id.toString();

  const syncPlayersList = async () => {
    const fresh = await getUsersByGameId(gameId);
    setUsersList(fresh);
    return fresh;
  };

  try {
    const users: IUser[] = await syncPlayersList();

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
      const alreadyInThisGame =
        String(existingUserGlobal.game_id ?? "") === String(id ?? "");

      if (alreadyInThisGame) {
        // Re-entry (tab switch, auth refresh): never clear round fields — that was wiping my_song_id / votes.
        markRecentJoin(String(user.id));
        await markUserLoggedIn(String(user.id));
        const meInRoom = users.find((u) => String(u.id) === String(user.id));
        setCurrentUser(
          meInRoom
            ? { ...meInRoom, is_logged: true }
            : { ...existingUserGlobal, is_logged: true },
        );
        setIsUserCreated(true);
        await syncPlayersList();
        return;
      }

      // Row exists but belongs to another game — join this room and reset round state for the new game.
      try {
        markRecentJoin(String(user.id));
        await updateUser(String(user.id), {
          game_id: id,
          avatar: existingUserGlobal.avatar || (user ? uuid() : ""),
          my_song_voted: false,
          master_song_voted: false,
          points: existingUserGlobal.points ?? 0,
          my_song_id: "",
          master_song_id: "",
          is_logged: true,
        });
        const merged = {
          ...existingUserGlobal,
          game_id: id as IUser["game_id"],
          is_logged: true,
          my_song_voted: false,
          master_song_voted: false,
          my_song_id: "",
          master_song_id: "",
        };
        setCurrentUser(merged);
        setIsUserCreated(true);
        await syncPlayersList();
        return;
      } catch (err) {
        setErrorMessage("Error updating existing user");
        return;
      }
    }

    try {
      const newUser = {
        id: user.id,
        game_id: gameId as IUser["game_id"],
        name: currentUserName || uuid(),
        avatar: user
          ? getRandomAvatar(users.map((u) => u.avatar)).iconName
          : "",
        my_song_voted: false,
        master_song_voted: false,
        points: 0,
        my_song_id: "",
        master_song_id: "",
        is_logged: true,
      };
      markRecentJoin(String(user.id));
      setCurrentUser(newUser);
      await createUser(newUser);
      await markUserLoggedIn(String(user.id));
      setIsUserCreated(true);
      await syncPlayersList();
    } catch {
      setIsUserCreated(false);
      setErrorMessage("Error creating user");
    }
  } catch (err) {
    setErrorMessage("Error fetching users");
  }
};
