import React, { useEffect, useState } from "react";
import { useSpotifyRandomSearch } from "../../services/spotifyTanStackService";
import { useParams } from "react-router";
import { createUser, getUsersBySessionId } from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { v4 as uuid, UUIDTypes } from "uuid";
import getRandomAvatar, { icons } from "../../utils/getRandomAvatar";
import { IUser } from "../../api/interface";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const Game = () => {
  const { user } = useAuth();
  const { data, error, isLoading } = useSpotifyRandomSearch();
  const { id } = useParams();
  const [isUserCreated, setIsUserCreated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usersList, setUsersList] = useState<IUser[]>([]);

  useEffect(() => {
    if (error) {
      setErrorMessage("Error fetching playlists");
    }
  }, [error]);

  useEffect(() => {
    if (id && user) {
      getUsersBySessionId(id).then((users: IUser[]) => {
        setUsersList(users);
        if (
          users.length > 1 ||
          users[0].name !== user.user_metadata?.full_name
        ) {
          createUser({
            id: uuid(),
            session_id: id,
            game_id: users[0].game_id,
            name: user.user_metadata?.name ? user.user_metadata?.name : uuid(),
            avatar: user
              ? getRandomAvatar(users.map((u) => u.avatar)).iconName
              : "",
            voted: false,
            points: 0,
            song_id: "",
            is_logged: true,
          })
            .then(() => {
              setIsUserCreated(true);
            })
            .catch((err) => {
              setIsUserCreated(false);
              setErrorMessage("Error creating user");
            });
        } else if (users.length >= 6) {
          setIsUserCreated(true);
          setErrorMessage("Too many players");
        } else {
          setIsUserCreated(true);
        }
      });
    }
  }, [id, user]);

  return (
    <div>
      <h1>Imagine the music</h1>
      {isLoading && !isUserCreated ? <p>Loading...</p> : null}
      {errorMessage && <p>{errorMessage}</p>}
      {data && isUserCreated ? <>hi</> : null}
      {usersList.length > 0 && (
        <div className="bg-white/50 rounded p-4 mt-4 w-fit shadow-lg">
          <h2 className="text-lg font-bold text-indigo-400 mb-2">Players:</h2>
          <ul>
            {usersList.map((u) => (
              <li key={u.name}>
                <FontAwesomeIcon
                  icon={icons[u.avatar as keyof typeof icons]}
                  className="text-indigo-400"
                />
                <span className="ml-2 mr-2 font-bold">{u.name}</span>
                <span className="mr-2">{`${u.points} ${
                  u.points === 1 ? "point" : "points"
                }`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Game;
