import React, { useCallback, useEffect, useState, useRef } from "react";
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
import { useGamePresence } from "../../hooks/useGamePresence";
import Timer from "../../components/Timer/Timer";
import { toBool } from "../../utils/toBool";
import {
  applyUsersRealtimeToCache,
  usersQueryKey,
} from "../../utils/usersQueryCache";

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
  const gameId = id?.toString() ?? "";

  const { data: usersList = [], refetch: refetchUsers } = useQuery<
    IUser[],
    Error
  >({
    queryKey: usersQueryKey(gameId),
    queryFn: async () => (gameId ? await getUsersByGameId(gameId) : []),
    enabled: !!gameId,
    staleTime: 0,
    refetchOnWindowFocus: true,
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
  const isUsersSelectState = game?.state === GameState.USERS_SELECT;
  const isUsersVoteState = game?.state === GameState.USERS_VOTE;
  const prevGameStateRef = useRef<GameState | undefined>(undefined);
  const selectPhaseFinalizeRef = useRef(false);

  const handleTimerFinish = useCallback(() => {
    setTimeIsUp(true);
  }, []);

  const refreshUsers = useCallback(() => {
    if (gameId) {
      void queryClient.invalidateQueries({ queryKey: usersQueryKey(gameId) });
    }
  }, [gameId, queryClient]);

  const masterIdRef = useRef<UUIDTypes | null>(masterId);

  const voteSongIdsKey = usersList
    .filter((u) => u.my_song_id && u.my_song_id.trim().length > 0)
    .map((u) => `${u.id}:${u.my_song_id}`)
    .sort()
    .join("|");
  const messageStyle =
    "w-72 rounded-lg bg-indigo-50 text-indigo-600 px-4 py-3 mt-3 text-center font-semibold shadow-sm block text-sm text-indigo-500";
  // different type of styling message "w-80 border-2 border-indigo-400 rounded-lg bg-white/60 text-indigo-400 px-4 py-2 mt-3 text-center font-medium shadow-sm";

  useEffect(() => {
    masterIdRef.current = masterId;
  }, [masterId]);

  useGamePresence(user?.id, gameId);

  // Random Spotify pool for master / users selection — not during vote or final.
  useEffect(() => {
    if (!data) return;
    if (
      game?.state === GameState.USERS_VOTE ||
      game?.state === GameState.FINAL
    ) {
      return;
    }

    const typed = data as unknown as ISpotifyData | null;
    const items = typed?.tracks?.items ?? [];
    setTracks(items.slice(0, 6));
  }, [data, game?.state]);

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
    if (!gameId) return;

    const usersSub = supabase
      .channel(`users-changes-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        (payload) => {
          applyUsersRealtimeToCache(queryClient, gameId, payload);

          const newRec = payload.new as IUser | null;
          if (
            newRec &&
            masterIdRef.current != null &&
            String(masterIdRef.current) === String(newRec.id) &&
            toBool(newRec.my_song_voted)
          ) {
            setMasterVoted(true);
          }
        },
      )
      .subscribe();

    const gameSub = supabase
      .channel(`game-changes-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const newRec = payload.new as IGame | null;
          if (newRec) setGame(newRec);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(usersSub);
      supabase.removeChannel(gameSub);
    };
  }, [gameId, queryClient]);

  useEffect(() => {
    if (game && !masterId) {
      setMasterId(game.master_id);
    }
  }, [game, masterId]);

  // Keep currentUser in sync with Supabase (selections, votes, timeouts).
  useEffect(() => {
    if (!user?.id || !usersList.length) return;
    const row = usersList.find((u) => String(u.id) === String(user.id));
    if (row) setCurrentUser(row);
  }, [usersList, user?.id]);

  // Keep UI in sync if DB already has master's pick (e.g. after refetch or missed realtime).
  useEffect(() => {
    if (!masterId || !usersList.length) return;
    const masterRow = usersList.find((u) => String(u.id) === String(masterId));
    if (
      masterRow?.my_song_voted &&
      typeof masterRow.my_song_id === "string" &&
      masterRow.my_song_id.trim().length > 0
    ) {
      setMasterVoted(true);
    }
  }, [usersList, masterId]);

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

  // Clear "time is up" when entering a timed phase so the new Timer instance can run.
  useEffect(() => {
    const prev = prevGameStateRef.current;
    const next = game?.state;

    if (
      next === GameState.USERS_VOTE &&
      prev !== GameState.USERS_VOTE
    ) {
      setTimeIsUp(false);
    } else if (
      next === GameState.USERS_SELECT &&
      prev !== GameState.USERS_SELECT
    ) {
      setTimeIsUp(false);
      selectPhaseFinalizeRef.current = false;
    }

    prevGameStateRef.current = next;

    if (next === GameState.USERS_VOTE && id) {
      void queryClient.invalidateQueries({ queryKey: usersQueryKey(gameId) });
    }
  }, [game?.state, gameId, queryClient]);

  // Vote phase: show every player's submitted song (my_song_id) from Supabase.
  useEffect(() => {
    if (game?.state !== GameState.USERS_VOTE) return;

    let mounted = true;
    setTracksLoading(true);

    (async () => {
      try {
        const usersWithSong = usersList.filter(
          (u) => u.my_song_id && u.my_song_id.trim().length > 0,
        );

        if (usersWithSong.length === 0) {
          if (mounted) setTracks([]);
          return;
        }

        const results = await Promise.all(
          usersWithSong.map(async (u) => {
            try {
              const track = await getSpotifyTrack(u.my_song_id);
              return track;
            } catch (err) {
              console.error("Failed to fetch vote track for user", u.id, err);
              return null;
            }
          }),
        );

        if (!mounted) return;
        setTracks(results.filter((t) => t != null));
      } catch (err) {
        console.error("Error loading vote-phase tracks:", err);
      } finally {
        if (mounted) setTracksLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [game?.state, voteSongIdsKey, usersList]);

  useEffect(() => {
    if (!id || !game?.state) return;

    const nonMasterUsers = usersList.filter((u) => u.id !== masterId);
    const randomTrackIdFromPool = (pool: Array<{ id: string }>) => {
      if (!pool.length) return "";
      return pool[Math.floor(Math.random() * pool.length)]?.id ?? "";
    };

    const moveToState = async (nextState: GameState) => {
      const isTimed =
        nextState === GameState.USERS_SELECT ||
        nextState === GameState.USERS_VOTE;

      const updates: Record<string, unknown> = { state: nextState };
      if (isTimed) {
        updates.timer_started_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("games")
        .update(updates)
        .eq("id", id.toString());

      if (error) {
        console.error(`Failed to update game state to ${nextState}`, error);
        return;
      }

      if (isTimed) {
        setTimeIsUp(false);
      }

      setGame((prev) =>
        prev
          ? {
              ...prev,
              state: nextState,
              ...(isTimed
                ? { timer_started_at: updates.timer_started_at as string }
                : {}),
            }
          : prev,
      );
    };

    if (game.state === GameState.MASTER_SELECTS) {
      if (masterVoted) {
        void moveToState(GameState.USERS_SELECT);
      }
      return;
    }

    if (game.state === GameState.USERS_SELECT) {
      const finalizeSelectPhaseOnTimeout = async () => {
        if (!timeIsUp || selectPhaseFinalizeRef.current) return;
        selectPhaseFinalizeRef.current = true;

        const selectionPool = tracks.slice(0, 6).filter((t) => !!t?.id);
        const usersNeedingSong = nonMasterUsers.filter(
          (u) =>
            typeof u.my_song_id !== "string" || u.my_song_id.trim().length === 0,
        );

        if (selectionPool.length > 0 && usersNeedingSong.length > 0) {
          await Promise.all(
            usersNeedingSong.map(async (u) => {
              const { error } = await supabase
                .from("users")
                .update({
                  my_song_id: randomTrackIdFromPool(selectionPool),
                  my_song_voted: true,
                })
                .eq("id", u.id.toString());

              if (error) {
                console.error(
                  "Failed to auto-assign my_song_id on timeout for user",
                  u.id,
                  error,
                );
              }
            }),
          );

          await queryClient.invalidateQueries({ queryKey: usersQueryKey(gameId) });
        }

        await moveToState(GameState.USERS_VOTE);
      };

      void finalizeSelectPhaseOnTimeout();
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
        nonMasterUsers.every((u) => toBool(u.master_song_voted));

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
    queryClient,
  ]);

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
            queryClient.setQueryData(usersQueryKey(gameId), users),
          setIsUserCreated,
          setErrorMessage,
          setCurrentUser,
        });
      }
    })();
    // Depend on `user?.id` only so TOKEN_REFRESHED (new session object, same id) does not re-run join.
  }, [id, user?.id, authLoading, navigate, queryClient]);

  useEffect(() => {
    if (game?.state === GameState.USERS_VOTE) {
      if (currentUser?.id === masterId) {
        setIsButtonSelectDisabled(true);
      } else {
        setIsButtonSelectDisabled(!!currentUser?.master_song_voted);
      }
      return;
    }

    if (currentUser?.id === masterId) {
      setIsButtonSelectDisabled(!!masterVoted);
    } else {
      setIsButtonSelectDisabled(!masterVoted);
    }
  }, [
    game?.state,
    isUserCreated,
    usersList,
    currentUser,
    masterId,
    selectedTrack,
    masterVoted,
  ]);

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
        isVotePhase={isUsersVoteState}
        tracksLoading={tracksLoading}
        masterId={masterId}
        currentUser={currentUser}
        onUserUpdated={refreshUsers}
      />
      <div className="flex flex-col items-center">
        {" "}
        {usersList.length > 0 && (
          <PlayersList
            usersList={usersList}
            masterId={masterId}
            gameState={game?.state}
          />
        )}
        <CopyLink />
        {isUsersVoteState ? (
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
        {(isUsersSelectState || isUsersVoteState) &&
        game?.timer_started_at ? (
          <Timer
            key={game.state}
            timeSec={120}
            startedAt={game.timer_started_at}
            onFinish={handleTimerFinish}
          />
        ) : null}
      </div>
    </div>
  );
};

export default Game;
