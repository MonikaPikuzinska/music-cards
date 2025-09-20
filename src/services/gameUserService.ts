import { v4 as uuid, UUIDTypes } from "uuid";
import { createUser, getGameById, getUsersBySessionId } from "../api/api";
import getRandomAvatar from "../utils/getRandomAvatar";
import { IUser, IGame } from "../api/interface";

interface HandleUserJoinGameParams {
  id: UUIDTypes | string;
  user: any;
  setUsersList: (users: IUser[]) => void;
  setMasterId: (id: UUIDTypes) => void;
  setIsUserCreated: (created: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
}

export const handleUserJoinGame = async ({
  id,
  user,
  setUsersList,
  setMasterId,
  setIsUserCreated,
  setErrorMessage,
}: HandleUserJoinGameParams) => {
  try {
    const users: IUser[] = await getUsersBySessionId(id.toString());
    setUsersList(users);

    // Fetch game and set masterId if users exist
    if (users.length > 0) {
      try {
        const game: IGame = await getGameById(users[0].game_id.toString());
        setMasterId(game.master_id);
      } catch {
        setErrorMessage("Error fetching game data");
      }
    }

    // Check for max players first
    if (users.length >= 6) {
      setIsUserCreated(true);
      setErrorMessage("Too many players");
      return;
    }

    // Check if current user already exists
    const currentUserName =
      user.user_metadata?.full_name || user.user_metadata?.name || "";
    const userExists = users.some((u) => u.name === currentUserName);

    if (!userExists) {
      try {
        await createUser({
          id: uuid(),
          session_id: id,
          game_id: users[0]?.game_id,
          name: currentUserName || uuid(),
          avatar: user
            ? getRandomAvatar(users.map((u) => u.avatar)).iconName
            : "",
          voted: false,
          points: 0,
          song_id: "",
          is_logged: true,
        });
        setIsUserCreated(true);
      } catch {
        setIsUserCreated(false);
        setErrorMessage("Error creating user");
      }
    } else {
      setIsUserCreated(true);
    }
  } catch (err) {
    setErrorMessage("Error fetching users");
  }
};
