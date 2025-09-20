import React, { useEffect, useState } from "react";
import { useSpotifyRandomSearch } from "../../services/spotifyTanStackService";
import { useParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { UUIDTypes } from "uuid";
import { IUser } from "../../api/interface";
import PlayersList from "../../components/PlayersList/PlayersList";
import CopyLink from "../../components/CopyLink/CopyLink";
import SpotifyPlayer from "../../components/SpotifyPlayer/SpotifyPlayer";
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
      });
    }
  }, [id, user]);

  return (
    <div className="flex flex-row items-start p-4">
      {isLoading && !isUserCreated ? <p>Loading...</p> : null}
      {errorMessage && <p>{errorMessage}</p>}
      <div className="flex flex-wrap justify-center items-center max-w-9/12">
        {data &&
          isUserCreated &&
          (data as ISpotifyData).tracks &&
          (data as ISpotifyData).tracks.items &&
          (data as ISpotifyData).tracks.items.length > 0 &&
          (data as ISpotifyData).tracks.items
            .slice(0, 6)
            .map((item: ISpotifyTrackItem) => (
              <SpotifyPlayer
                key={item.id}
                link={item.external_urls.spotify}
                isSelected={selectedTrack === item.id}
                onSelect={() => setSelectedTrack(item.id)}
              />
            ))}
        <div className="w-full text-center">
          <button
            onClick={() => setSelectedTrack(null)}
            className="px-3 py-1 bg-indigo-400 text-white rounded hover:bg-indigo-500 transition-colors"
          >
            Select
          </button>
        </div>{" "}
      </div>
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
