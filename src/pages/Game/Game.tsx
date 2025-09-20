import React, { useEffect, useState } from "react";
import { useSpotifyRandomSearch } from "../../services/spotifyTanStackService";
import { useParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { UUIDTypes } from "uuid";
import { IUser } from "../../api/interface";
import PlayersList from "../../components/PlayersList/PlayersList";
import CopyLink from "../../components/CopyLink/CopyLink";
import { handleUserJoinGame } from "../../services/gameUserService";

const Game = () => {
  const { user } = useAuth();
  const { data, error, isLoading } = useSpotifyRandomSearch();
  const { id } = useParams();
  const [isUserCreated, setIsUserCreated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usersList, setUsersList] = useState<IUser[]>([]);
  const [masterId, setMasterId] = useState<UUIDTypes | null>(null);

  useEffect(() => {
    if (error) {
      setErrorMessage("Error fetching playlists");
    }
  }, [error]);

  useEffect(() => {
    if (id && user) {
      handleUserJoinGame({
        id: id.toString(),
        user,
        setUsersList,
        setMasterId,
        setIsUserCreated,
        setErrorMessage,
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
        <PlayersList usersList={usersList} masterId={masterId} />
      )}
      <CopyLink />
    </div>
  );
};

export default Game;
