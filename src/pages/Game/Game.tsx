import React, { useEffect, useState } from "react";
import { useSpotifyRandomSearch } from "../../services/spotifyTanStackService";
import { useParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { UUIDTypes } from "uuid";
import { IUser } from "../../api/interface";
import PlayersList from "../../components/PlayersList/PlayersList";
import CopyLink from "../../components/CopyLink/CopyLink";
import SpotifyPlayer from "../../components/SpotifyPlayer/SpotifyPlayer";
import SongsList from "../../components/SongsList/SongsList";
import { handleUserJoinGame } from "../../services/gameUserService";

interface ISpotifyTrackItem {
  id: string;
  external_urls: {
    spotify: string;
  };
}

interface ISpotifyData {
  tracks: {
    items: ISpotifyTrackItem[];
  };
}

const Game = () => {
  const { user } = useAuth();
  const { data, error, isLoading } = useSpotifyRandomSearch();
  const { id } = useParams();
  const [isUserCreated, setIsUserCreated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usersList, setUsersList] = useState<IUser[]>([]);
  const [masterId, setMasterId] = useState<UUIDTypes | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const [isButtonSelectDisabled, setIsButtonSelectDisabled] =
    useState<boolean>(false);
  console.log(data);

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
        setCurrentUser,
      });
    }
  }, [id, user]);

  useEffect(() => {
    setIsButtonSelectDisabled(
      !isUserCreated ||
        usersList.length < 4 ||
        !selectedTrack ||
        currentUser?.id !== masterId
    );
  }, [isUserCreated, usersList, currentUser, masterId, selectedTrack]);

  return (
    <div className="flex flex-row items-start p-4">
      {isLoading && !isUserCreated ? <p>Loading...</p> : null}
      {errorMessage && <p>{errorMessage}</p>}
      <SongsList
        tracks={
          data &&
          (data as ISpotifyData).tracks &&
          (data as ISpotifyData).tracks.items
            ? (data as ISpotifyData).tracks.items
            : []
        }
        isUserCreated={isUserCreated}
        selectedTrack={selectedTrack}
        setSelectedTrack={setSelectedTrack}
        isSelectDisabled={isButtonSelectDisabled}
      />
      <div className="flex flex-col items-center">
        {" "}
        {usersList.length > 0 && (
          <PlayersList usersList={usersList} masterId={masterId} />
        )}
        <CopyLink />
      </div>
    </div>
  );
};

export default Game;
