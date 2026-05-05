import React, { useEffect, useState, useRef } from "react";
import { useSpotifyRandomSearch } from "../../services/spotifyTanStackService";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UUIDTypes } from "uuid";
import { GameState, IGame, IUser } from "../../api/interface";
import PlayersList from "../../components/PlayersList/PlayersList";
import CopyLink from "../../components/CopyLink/CopyLink";
import SongsList from "../../components/SongsList/SongsList";
import { handleUserJoinGame } from "../../services/gameUserService";
import {
  getSpotifyTrack,
  isSpotifySessionValid,
} from "../../services/spotifyService";
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
  const { user, authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { data, error, isLoading } = useSpotifyRandomSearch();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: usersList = [], refetch: refetchUsers } = useQuery<
    IUser[],
    Error
  >({
    queryKey: ["users", id],
    queryFn: async () => (id ? await getUsersByGameId(id.toString()) : []),
    enabled: !!id,
  });
  const [isUserCreated, setIsUserCreated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
  const isUsersSelectState = game?.state === GameState.USERS_SELECT;
  const isUsersVoteState = game?.state === GameState.USERS_VOTE;

  const masterIdRef = useRef<UUIDTypes | null>(masterId);
  const messageStyle =
    "w-72 rounded-lg bg-indigo-50 text-indigo-600 px-4 py-3 mt-3 text-center font-semibold shadow-sm block text-sm text-indigo-500";
  // different type of styling message "w-80 border-2 border-indigo-400 rounded-lg bg-white/60 text-indigo-400 px-4 py-2 mt-3 text-center font-medium shadow-sm";

  useEffect(() => {
    masterIdRef.current = masterId;
  }, [masterId]);

  // Initial list of random Spotify tracks:
  // - load once when page opens (see query options in useSpotifyRandomSearch)
  // - do NOT overwrite tracks after the selection phase has finished
  useEffect(() => {
    if (!data || isSelectingTrackFinished) return;

    const typed = data as unknown as ISpotifyData | null;
    const items = typed?.tracks?.items ?? [];
    setTracks(items.slice(0, 6));
  }, [data, isSelectingTrackFinished]);

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

    const invalidateUsers = async () => {
      try {
        await queryClient.invalidateQueries({ queryKey: ["users", id] });
      } catch (err) {
        console.error("Failed to invalidate users after realtime event", err);
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

          // debounce canonical invalidation to avoid many rapid requests
          if (refetchTimer) clearTimeout(refetchTimer);
          refetchTimer = setTimeout(() => {
            invalidateUsers();
            refetchTimer = null;
          }, 150);

          // if the master user's row was updated and the master has voted, mark masterVoted
          const newRec = (payload as any)?.new as IUser | null;
          if (
            newRec &&
            typeof newRec === "object" &&
            "id" in newRec &&
            masterIdRef.current === (newRec as any).id &&
            !!(newRec as any).my_song_voted
          ) {
            setMasterVoted(true);
          }
        },
      )
      .subscribe();

    // Optionally watch the game row changes too (filtered by id)
    const gameSub = supabase
      .channel(`game-changes-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${id}` },
        (payload) => {
          console.log("Game table changed:", payload);
          const newRec = (payload as any)?.new as IGame | null;
          if (newRec) setGame(newRec);
        },
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

  // when usersList changes, fetch Spotify tracks for users that submitted my_song_id
  useEffect(() => {
    if (!usersList || usersList.length === 0) return;
    let mounted = true;

    const pending = usersList
      .filter((u) => u.my_song_id && u.my_song_id.length > 0)
      .filter((u) => !selectedSongsList.some((s) => s.userId === u.id));

    if (pending.length === 0) return;

    // fetch all pending tracks
    (async () => {
      try {
        const promises = pending.map(async (u) => {
          try {
            const track = await getSpotifyTrack(u.my_song_id);
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

  useEffect(() => {
    if (!id || !game?.state) return;

    const nonMasterUsers = usersList.filter((u) => u.id !== masterId);
    const randomTrackIdFromPool = (pool: Array<{ id: string }>) => {
      if (!pool.length) return "";
      return pool[Math.floor(Math.random() * pool.length)]?.id ?? "";
    };

    const moveToState = async (nextState: GameState) => {
      const { error } = await supabase
        .from("games")
        .update({ state: nextState })
        .eq("id", id.toString());

      if (error) {
        console.error(`Failed to update game state to ${nextState}`, error);
        return;
      }

      setGame((prev) => (prev ? { ...prev, state: nextState } : prev));
    };

    if (game.state === GameState.MASTER_SELECTS) {
      if (masterVoted) {
        void moveToState(GameState.USERS_SELECT);
      }
      return;
    }

    if (game.state === GameState.USERS_SELECT) {
      const assignMissingMySongIdsOnTimeout = async () => {
        if (!timeIsUp) return;
        if (!currentUser || currentUser.id === masterId) return;
        if (
          typeof currentUser.my_song_id === "string" &&
          currentUser.my_song_id.trim().length > 0
        ) {
          return;
        }

        const selectionPool = tracks.slice(0, 6).filter((t) => !!t?.id);
        if (selectionPool.length === 0) return;

        const { error } = await supabase
          .from("users")
          .update({
            my_song_id: randomTrackIdFromPool(selectionPool),
            my_song_voted: true,
          })
          .eq("id", currentUser.id.toString());

        if (error) {
          console.error("Failed to auto-assign my_song_id on timeout", error);
        }
      };
      void assignMissingMySongIdsOnTimeout();

      const allNonMasterSongsSelected =
        nonMasterUsers.length > 0 &&
        nonMasterUsers.every(
          (u) =>
            typeof u.my_song_id === "string" && u.my_song_id.trim().length > 0,
        );

      if (timeIsUp && allNonMasterSongsSelected) {
        void moveToState(GameState.USERS_VOTE);
      }
      return;
    }

    if (game.state === GameState.USERS_VOTE) {
      const assignMissingMasterSongIdsOnTimeout = async () => {
        if (!timeIsUp) return;
        if (!currentUser || currentUser.id === masterId) return;
        if (
          typeof currentUser.master_song_id === "string" &&
          currentUser.master_song_id.trim().length > 0
        ) {
          return;
        }

        const votePool = tracks.filter((t) => !!t?.id);
        if (votePool.length === 0) return;

        const { error } = await supabase
          .from("users")
          .update({
            master_song_id: randomTrackIdFromPool(votePool),
            master_song_voted: true,
          })
          .eq("id", currentUser.id.toString());

        if (error) {
          console.error(
            "Failed to auto-assign master_song_id on timeout",
            error,
          );
        }
      };
      void assignMissingMasterSongIdsOnTimeout();

      const allNonMasterUsersVoted =
        nonMasterUsers.length > 0 &&
        nonMasterUsers.every((u) => u.master_song_voted === true);

      if (allNonMasterUsersVoted) {
        void moveToState(GameState.FINAL);
      }
    }
  }, [
    id,
    game?.state,
    masterVoted,
    timeIsUp,
    usersList,
    masterId,
    tracks,
    currentUser,
  ]);

  useEffect(() => {
    if (isUsersSelectState || isUsersVoteState) {
      setTimeIsUp(false);
    }
  }, [isUsersSelectState, isUsersVoteState]);

  // when selection phase finishes, fetch each user's submitted song (my_song_id)
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
      console.log("tracks", tracks, selectedSongsList, isSelectingTrackFinished);

      try {
        // When selection phase is finished and we are about to show the list
        // of songs based on my_song_id, reset `my_song_voted` to false for all users
        // in this game so they can vote in the next phase.
        if (id) {
          const { error: voteResetError } = await supabase
            .from("users")
            .update({ my_song_voted: false, my_song_id: "" })
            .eq("game_id", id.toString());

          if (voteResetError) {
            console.error("Failed to reset voted flags for users", voteResetError);
          }
        }

        const usersWithSong = usersList.filter(
          (u) => u.my_song_id && u.my_song_id.toString().length > 0,
        );

        if (usersWithSong.length === 0) {
          if (mounted) setTracks([]);
          return;
        }

        const promises = usersWithSong.map(async (u) => {
          try {
            const track = await getSpotifyTrack(u.my_song_id);
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
    // If we don't know auth state yet, wait
    if (!id) return;
    if (authLoading) return;
    if (!user) {
      if (window.location.pathname === "/login") return;

      // redirect to login and include returnTo so user comes back to this game
      navigate(`/login?returnTo=/game/${id}`);
      return;
    }
    (async () => {
      // Verify spotify session validity; if invalid, sign out and redirect to login
      const valid = await isSpotifySessionValid();
      if (!valid) {
        await signOut();
        navigate(`/login?returnTo=/game/${id}`);
        return;
      }

      if (id && user) {
        handleUserJoinGame({
          id: id.toString(),
          user,
          setUsersList: (users: IUser[]) =>
            queryClient.setQueryData(["users", id], users),
          setIsUserCreated,
          setErrorMessage,
          setCurrentUser,
        });
      }
    })();
  }, [id, user, authLoading, navigate]);

  useEffect(() => {
    // Button logic:
    // - If there are less than 4 players, disable
    // - If current user is the master: disable after master has voted
    // - If current user is NOT the master: enable only after master has voted
    // if (usersList.length < 4) {
    //   setIsButtonSelectDisabled(true);
    //   return;
    // }

    if (currentUser?.id === masterId) {
      setIsButtonSelectDisabled(!!masterVoted);
    } else {
      setIsButtonSelectDisabled(!masterVoted);
    }
  }, [
    isUserCreated,
    usersList,
    currentUser,
    masterId,
    selectedTrack,
    masterVoted,
  ]);

  // whenever voting state changes, bump timerKey so Timer remounts and restarts
  useEffect(() => {
    setTimerKey((k) => k + 1);
  }, [startVotingForTrack, isUsersSelectState, isUsersVoteState]);

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
        timeIsUp={timeIsUp}
        startVotingForTrack={startVotingForTrack}
        masterId={masterId}
        currentUser={currentUser}
      />
      <div className="flex flex-col items-center">
        {" "}
        {usersList.length > 0 && (
          <PlayersList
            usersList={usersList}
            masterId={masterId}
            timeIsUp={timeIsUp}
          />
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
        {isUsersSelectState || isUsersVoteState ? (
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
