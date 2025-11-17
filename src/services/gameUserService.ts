import { v4 as uuid, UUIDTypes } from "uuid";
import { createUser, getGameById, getUsersByGameId } from "../api/api";
import getRandomAvatar from "../utils/getRandomAvatar";
import { IUser, IGame } from "../api/interface";

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

    // Check if current user already exists
    const currentUserName =
      user.user_metadata?.full_name || user.user_metadata?.name || "";
    const userExists = users.find((u) => u.name === currentUserName);

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
