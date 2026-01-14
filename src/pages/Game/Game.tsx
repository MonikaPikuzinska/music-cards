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
import { getSpotifyTrack } from "../../services/spotifyService";
import { supabase } from "../../supabase-client";
import { getGameById, getUsersByGameId } from "../../api/api";
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
  const [timeIsUp, setTimeIsUp] = useState<boolean>(false);
  const [selectedSongsList, setSelectedSongsList] = useState<
    Array<{ userId: string; track: any }>
  >([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [tracksLoading, setTracksLoading] = useState<boolean>(false);
  const [isSelectingTrackFinished, setIsSelectingTrackFinished] =
    useState<boolean>(false);
  const [startVotingForTrack, setIsStartVotingForTrack] =
    useState<boolean>(false);
  const [timerKey, setTimerKey] = useState<number>(0);

  const masterIdRef = useRef<UUIDTypes | null>(masterId);
  const messageStyle =
    "w-72 rounded-lg bg-indigo-50 text-indigo-600 px-4 py-3 mt-3 text-center font-semibold shadow-sm block text-sm text-indigo-500";
  // different type of styling message "w-80 border-2 border-indigo-400 rounded-lg bg-white/60 text-indigo-400 px-4 py-2 mt-3 text-center font-medium shadow-sm";

  useEffect(() => {
    masterIdRef.current = masterId;
  }, [masterId]);

  useEffect(() => {
    if (data) {
      setTracks(
        data &&
          (data as unknown as ISpotifyData).tracks &&
          (data as unknown as ISpotifyData).tracks.items
          ? (data as unknown as ISpotifyData).tracks.items.slice(0, 6)
          : []
      );
    }
  }, [data]);

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
    // don't subscribe until we have a game id
    if (!id) return;

    let mounted = true;
    // small debounce timer to coalesce bursts of realtime events
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchFreshUsers = async () => {
      try {
        const fresh = await getUsersByGameId(id.toString());
        if (mounted) setUsersList(fresh || []);
      } catch (err) {
        console.error("Failed to refresh users after realtime event", err);
      }
    };

    // Subscribe to changes in 'users' table for this specific game_id
    const usersSub = supabase
      .channel(`users-changes-${id}`)
      .on(
        "postgres_changes",
        // listen to all change types (INSERT/UPDATE/DELETE) and filter server-side by game_id
        {
          event: "*",
          schema: "public",
          table: "users",
          filter: `game_id=eq.${id}`,
        },
        (payload) => {
          console.log("users change (filtered by game_id):", payload);

          // debounce canonical refetch to avoid many rapid requests
          if (refetchTimer) clearTimeout(refetchTimer);
          refetchTimer = setTimeout(() => {
            fetchFreshUsers();
            refetchTimer = null;
          }, 150);

          // if the master user's row was updated and contains a new record, mark masterVoted
          const newRec = (payload as any)?.new as IUser | null;
          if (
            newRec &&
            typeof newRec === "object" &&
            "id" in newRec &&
            masterIdRef.current === (newRec as any).id
          ) {
            setMasterVoted(true);
          }
        }
      )
      .subscribe();

    // Optionally watch the game row changes too (filtered by id)
    const gameSub = supabase
      .channel(`game-changes-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game", filter: `id=eq.${id}` },
        (payload) => {
          console.log("Game table changed:", payload);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      if (refetchTimer) clearTimeout(refetchTimer);
      supabase.removeChannel(usersSub);
      supabase.removeChannel(gameSub);
    };
    // only re-subscribe when the id changes
  }, [id]);

  useEffect(() => {
    if (game && !masterId) {
      setMasterId(game.master_id);
    }
  }, [game, masterId]);

  // when usersList changes, fetch Spotify tracks for users that submitted song_id
  useEffect(() => {
    if (!usersList || usersList.length === 0) return;
    let mounted = true;

    const pending = usersList
      .filter((u) => u.song_id && u.song_id.length > 0)
      .filter((u) => !selectedSongsList.some((s) => s.userId === u.id));

    if (pending.length === 0) return;

    // fetch all pending tracks
    (async () => {
      try {
        const promises = pending.map(async (u) => {
          try {
            const track = await getSpotifyTrack(u.song_id);
            return { userId: u.id.toString(), track };
          } catch (err) {
            console.error("Failed to fetch track for user", u.id, err);
            return null;
          }
        });

        const results = await Promise.all(promises);
        if (!mounted) return;
        const newItems = results.filter((r) => r !== null) as Array<{
          userId: string;
          track: any;
        }>;
        console.log("newItems", newItems);

        if (newItems.length > 0) {
          setSelectedSongsList((prev) => [...prev, ...newItems]);
        }
      } catch (err) {
        console.error("Error fetching selected songs:", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [usersList]);

  useEffect(() => {
    const finished = !!masterVoted && timeIsUp === true;
    console.log("finished", finished);
    setIsSelectingTrackFinished(finished);
  }, [masterVoted, timeIsUp, usersList]);

  // when selection phase finishes, fetch each user's submitted song (song_id)
  // and save the resulting Spotify track objects into `tracks`
  useEffect(() => {
    if (!isSelectingTrackFinished) return;
    if (!usersList || usersList.length === 0) {
      setTracks([]);
      return;
    }

    let mounted = true;

    setTracksLoading(true);
    (async () => {
      try {
        const usersWithSong = usersList.filter(
          (u) => u.song_id && u.song_id.toString().length > 0
        );

        if (usersWithSong.length === 0) {
          if (mounted) setTracks([]);
          return;
        }

        const promises = usersWithSong.map(async (u) => {
          try {
            const track = await getSpotifyTrack(u.song_id);
            return { userId: u.id, track };
          } catch (err) {
            console.error("Failed to fetch track for user", u.id, err);
            return null;
          }
        });

        const results = await Promise.all(promises);
        if (!mounted) return;

        const fetched = results.filter((r) => r !== null) as any[];

        const fetchedTracks = fetched.map((f) => f.track);
        setTracks(fetchedTracks);
        setIsStartVotingForTrack(true);
        console.log("fetched tracks for finished selection", fetchedTracks);
      } catch (err) {
        console.error("Error fetching tracks when selection finished:", err);
      } finally {
        if (mounted) setTracksLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isSelectingTrackFinished]);

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
        usersList.length < 4 ||
        !selectedTrack ||
        currentUser?.id !== masterId
    );
  }, [isUserCreated, usersList, currentUser, masterId, selectedTrack]);

  // whenever voting state changes, bump timerKey so Timer remounts and restarts
  useEffect(() => {
    setTimerKey((k) => k + 1);
  }, [startVotingForTrack, masterVoted]);

  return (
    <div className="flex flex-row items-start p-4">
      {isLoading && !isUserCreated ? <p>Loading...</p> : null}
      {errorMessage && <p>{errorMessage}</p>}
      <SongsList
        tracks={tracks ? tracks : []}
        isUserCreated={isUserCreated}
        selectedTrack={selectedTrack}
        setSelectedTrack={setSelectedTrack}
        isSelectDisabled={isButtonSelectDisabled}
        isSelectingTrackFinished={isSelectingTrackFinished}
      />
      <div className="flex flex-col items-center">
        {" "}
        {usersList.length > 0 && (
          <PlayersList usersList={usersList} masterId={masterId} />
        )}
        <CopyLink />
        {startVotingForTrack ? (
          user?.id === masterId ? (
            <p className={messageStyle}>
              Players have 2 minutes to vote for a song. You can listen to some
              music while they vote.
            </p>
          ) : (
            <p className={messageStyle}>
              You have 2 minutes to vote for the song you think the master
              selected.
            </p>
          )
        ) : masterVoted ? (
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
        {startVotingForTrack || masterVoted ? (
          <Timer
            key={timerKey}
            timeSec={120}
            onFinish={() => {
              setTimeIsUp(true);
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

export default Game;
