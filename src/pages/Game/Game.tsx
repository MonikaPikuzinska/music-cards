import React, { useEffect, useState, useRef } from "react";
import { useSpotifyRandomSearch } from "../../services/spotifyTanStackService";
import { useParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { UUIDTypes } from "uuid";
import { IGame, IUser } from "../../api/interface";
import PlayersList from "../../components/PlayersList/PlayersList";
import CopyLink from "../../components/CopyLink/CopyLink";
import SongsList from "../../components/SongsList/SongsList";
import { handleUserJoinGame } from "../../services/gameUserService";
import { supabase } from "../../supabase-client";
import { getGameById } from "../../api/api";
import Timer from "../../components/Timer/Timer";

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
  const [masterVoted, setMasterVoted] = useState<boolean>(false);
  const [game, setGame] = useState<IGame | null>(null);

  const masterIdRef = useRef<UUIDTypes | null>(masterId);
  const messageStyle =
    "w-72 rounded-lg bg-indigo-50 text-indigo-600 px-4 py-3 mt-3 text-center font-semibold shadow-sm block text-sm text-indigo-500";
  // different type of styling message "w-80 border-2 border-indigo-400 rounded-lg bg-white/60 text-indigo-400 px-4 py-2 mt-3 text-center font-medium shadow-sm";

  useEffect(() => {
    masterIdRef.current = masterId;
  }, [masterId]);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      try {
        const fetched = await getGameById(id.toString());
        if (mounted) setGame(fetched);
      } catch (err) {
        console.error("Failed to fetch game", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (error) {
      setErrorMessage("Error fetching playlists");
    }
  }, [error]);

  useEffect(() => {
    // Subscribe to changes in 'users' table
    const usersSub = supabase
      .channel("users-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        (payload) => {
          if (
            payload?.new &&
            typeof payload.new === "object" &&
            "id" in payload.new &&
            masterIdRef.current === (payload.new as any).id
          ) {
            setMasterVoted(true);
            console.log("Users table changed:", payload);
          }
        }
      )
      .subscribe();

    // Subscribe to changes in 'game' table
    const gameSub = supabase
      .channel("game-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game" },
        (payload) => {
          console.log("Game table changed:", payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(usersSub);
      supabase.removeChannel(gameSub);
    };
  }, [id, user]);

  useEffect(() => {
    if (game && !masterId) {
      setMasterId(game.master_id);
    }
  }, [game, masterId]);

  useEffect(() => {
    if (id && user) {
      handleUserJoinGame({
        id: id.toString(),
        user,
        setUsersList,
        setIsUserCreated,
        setErrorMessage,
        setCurrentUser,
      });
    }
  }, [id, user]);

  useEffect(() => {
    setIsButtonSelectDisabled(
      !isUserCreated ||
        // usersList.length < 4 ||
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
        {masterVoted ? (
          user?.id === masterId ? (
            <p className={messageStyle}>
              Players have 2min. to select a song. You can listen some music in
              the mean time.
            </p>
          ) : (
            <p className={messageStyle}>
              The master selected a song! Now you have 2 minutes to select a
              song.
            </p>
          )
        ) : null}
        {masterVoted ? <Timer timeSec={120} /> : null}
      </div>
    </div>
  );
};

export default Game;
