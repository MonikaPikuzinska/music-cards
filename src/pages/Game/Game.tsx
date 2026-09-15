import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UUIDTypes } from "uuid";
import { GameState, IGame, IUser } from "../../api/interface";
import PlayersList from "../../components/PlayersList/PlayersList";
import CopyLink from "../../components/CopyLink/CopyLink";
import SongsList from "../../components/SongsList/SongsList";
import RoundResults from "../../components/RoundResults/RoundResults";
import { handleUserJoinGame } from "../../services/gameUserService";
import {
  fetchUnusedSpotifyTracks,
  getSpotifyTrack,
  getSpotifyTracksByIds,
  isSpotifySessionValid,
} from "../../services/spotifyService";
import { supabase } from "../../supabase-client";
import { getGameById, getUsersByGameId, updateUser } from "../../api/api";
import { useGamePresence } from "../../hooks/useGamePresence";
import Timer from "../../components/Timer/Timer";
import { toBool } from "../../utils/toBool";
import {
  applyUsersRealtimeToCache,
  mergeUsersLists,
  patchUserInCache,
  refreshUsersForGame,
  usersQueryKey,
} from "../../utils/usersQueryCache";
import { toSpotifyListItem, sameTrackList } from "../../utils/spotifyTrack";
import { isLoggedIn } from "../../utils/isLoggedIn";
import { randomTrackIdFromPool } from "../../utils/canVoteForTrack";
import {
  GAME_TIMER_DURATION_SEC,
  HAND_SIZE,
  MIN_PLAYERS_TO_START,
  RECOMMENDED_PLAYERS_MIN,
  MAX_PLAYERS,
} from "../../constants/game";
import { finalizeVoteRound, startNextRound } from "../../services/roundService";
import {
  parseSongHand,
  pickUniqueHand,
  usedSongIdsFromUsers,
} from "../../utils/songHand";
import { nonMasterPlayers, shouldFinalizeVotePhase } from "../../utils/votePhase";

interface ISpotifyTrackItem {
  id: string;
  external_urls: {
    spotify: string;
  };
}

const messageStyle =
  "w-72 rounded-lg bg-indigo-50 text-indigo-600 px-4 py-3 mt-3 text-center font-semibold shadow-sm block text-sm text-indigo-500";

const Game = () => {
  const { user, authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const gameId = id?.toString() ?? "";

  const { data: usersList = [] } = useQuery<IUser[], Error>({
    queryKey: usersQueryKey(gameId),
    queryFn: async () => {
      const fresh = gameId ? await getUsersByGameId(gameId) : [];
      const prev =
        queryClient.getQueryData<IUser[]>(usersQueryKey(gameId)) ?? [];
      return mergeUsersLists(prev, fresh);
    },
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
  const [tracks, setTracks] = useState<ISpotifyTrackItem[]>([]);
  const [tracksLoading, setTracksLoading] = useState<boolean>(false);
  const [nextRoundLoading, setNextRoundLoading] = useState(false);
  const isUsersSelectState = game?.state === GameState.USERS_SELECT;
  const isUsersVoteState = game?.state === GameState.USERS_VOTE;
  const isFinalState = game?.state === GameState.FINAL;
  const isMasterSelectState = game?.state === GameState.MASTER_SELECTS;
  const prevGameStateRef = useRef<GameState | undefined>(undefined);
  const selectPhaseFinalizeRef = useRef(false);
  const votePhaseFinalizeRef = useRef(false);
  const dealingRef = useRef(false);
  const loadedHandKeyRef = useRef("");
  const loadedVoteKeyRef = useRef("");
  const usersListRef = useRef(usersList);
  usersListRef.current = usersList;

  const handleTimerFinish = useCallback(() => {
    setTimeIsUp(true);
  }, []);

  const handleUserSaved = useCallback(
    (userId: string, patch: Partial<IUser>) => {
      if (!gameId) return;
      patchUserInCache(queryClient, gameId, userId, patch);
      void refreshUsersForGame(queryClient, gameId);
    },
    [gameId, queryClient],
  );

  const resetLocalRound = useCallback(() => {
    setMasterVoted(false);
    setSelectedTrack(null);
    setSelectedSongsList([]);
    setTracks([]);
    setTimeIsUp(false);
    selectPhaseFinalizeRef.current = false;
    votePhaseFinalizeRef.current = false;
    dealingRef.current = false;
    loadedHandKeyRef.current = "";
    loadedVoteKeyRef.current = "";
  }, []);

  const handleNextRound = useCallback(async () => {
    if (!gameId || masterId == null) return;
    setNextRoundLoading(true);
    try {
      const next = await startNextRound({
        gameId,
        users: usersList,
        currentMasterId: String(masterId),
        gameNumber: game?.game_number ?? 1,
      });
      if (next) {
        setGame(next);
        resetLocalRound();
        await refreshUsersForGame(queryClient, gameId);
      }
    } catch (err) {
      console.error("Failed to start next round", err);
    } finally {
      setNextRoundLoading(false);
    }
  }, [game?.game_number, gameId, masterId, queryClient, resetLocalRound, usersList]);

  const masterIdRef = useRef<UUIDTypes | null>(masterId);

  const voteSongIdsKey = usersList
    .filter((u) => u.my_song_id && u.my_song_id.trim().length > 0)
    .map((u) => `${u.id}:${u.my_song_id}`)
    .sort()
    .join("|");

  const currentHandKey = [...parseSongHand(currentUser?.song_hand)]
    .sort()
    .join("|");

  const onlinePlayers = usersList.filter((u) => isLoggedIn(u));
  const waitingForPlayers = onlinePlayers.length < MIN_PLAYERS_TO_START;
  const isCurrentMaster =
    currentUser != null &&
    masterId != null &&
    String(currentUser.id) === String(masterId);

  const tracksById = useMemo(() => {
    const map: Record<string, ISpotifyTrackItem> = {};
    for (const item of selectedSongsList) {
      if (item.track?.id) {
        map[item.track.id] = toSpotifyListItem(item.track);
      }
    }
    for (const t of tracks) {
      if (t?.id) {
        map[t.id] = toSpotifyListItem(t);
      }
    }
    return map;
  }, [selectedSongsList, tracks]);

  useEffect(() => {
    masterIdRef.current = masterId;
  }, [masterId]);

  useGamePresence(user?.id, gameId);

  useEffect(() => {
    if (!gameId) return;
    const poll = window.setInterval(() => {
      void refreshUsersForGame(queryClient, gameId);
    }, 8_000);
    return () => window.clearInterval(poll);
  }, [gameId, queryClient]);

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
          if (!newRec) return;
          setGame((prev) => {
            if (
              prev?.state === GameState.FINAL &&
              newRec.state === GameState.USERS_VOTE
            ) {
              return prev;
            }
            return newRec;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(usersSub);
      supabase.removeChannel(gameSub);
    };
  }, [gameId, queryClient]);

  useEffect(() => {
    if (game?.master_id) {
      setMasterId(game.master_id);
    }
  }, [game?.master_id]);

  useEffect(() => {
    if (!user?.id || !usersList.length) return;
    const row = usersList.find((u) => String(u.id) === String(user.id));
    if (!row) return;
    setCurrentUser((prev) => {
      if (
        prev &&
        String(prev.id) === String(row.id) &&
        prev.name === row.name &&
        prev.points === row.points &&
        prev.my_song_id === row.my_song_id &&
        prev.master_song_id === row.master_song_id &&
        toBool(prev.my_song_voted) === toBool(row.my_song_voted) &&
        toBool(prev.master_song_voted) === toBool(row.master_song_voted) &&
        [...parseSongHand(prev.song_hand)].sort().join("|") ===
          [...parseSongHand(row.song_hand)].sort().join("|")
      ) {
        return prev;
      }
      return row;
    });
  }, [usersList, user?.id]);

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

  // Deal this player a unique 6-song hand that does not overlap with anyone else.
  useEffect(() => {
    if (!isUserCreated || !currentUser || !gameId) return;
    if (isUsersVoteState || isFinalState) return;
    const existing = parseSongHand(currentUser.song_hand);
    if (existing.length >= HAND_SIZE) return;
    if (dealingRef.current) return;

    dealingRef.current = true;
    let mounted = true;

    (async () => {
      try {
        const latest = await getUsersByGameId(gameId);
        const used = usedSongIdsFromUsers(latest, String(currentUser.id));
        const pool = await fetchUnusedSpotifyTracks(used, HAND_SIZE + 18);
        const ids = pickUniqueHand(pool, used, HAND_SIZE);
        if (!mounted) {
          dealingRef.current = false;
          return;
        }
        if (ids.length < HAND_SIZE) {
          dealingRef.current = false;
          if (ids.length === 0) {
            setErrorMessage("Could not deal unique songs. Try refreshing.");
          }
          return;
        }
        await updateUser(String(currentUser.id), { song_hand: ids });
        if (!mounted) {
          dealingRef.current = false;
          return;
        }
        handleUserSaved(String(currentUser.id), { song_hand: ids });
        dealingRef.current = false;
      } catch (err) {
        console.error("Failed to deal song hand", err);
        if (mounted) {
          setErrorMessage(
            "Could not save your song list. Add a song_hand column on users in Supabase, then refresh.",
          );
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    currentHandKey,
    currentUser?.id,
    gameId,
    handleUserSaved,
    isFinalState,
    isUserCreated,
    isUsersVoteState,
  ]);

  // Personal hand during pick phases. Do not refetch when the player list polls.
  useEffect(() => {
    if (isUsersVoteState || isFinalState) return;

    const hand = parseSongHand(currentUser?.song_hand);
    if (hand.length === 0) return;
    if (loadedHandKeyRef.current === currentHandKey) return;

    let mounted = true;
    if (loadedHandKeyRef.current === "") {
      setTracksLoading(true);
    }

    (async () => {
      try {
        const fetched = await getSpotifyTracksByIds(hand);
        if (!mounted) return;
        const next = fetched.map((t) => toSpotifyListItem(t));
        setTracks((prev) => (sameTrackList(prev, next) ? prev : next));
        loadedHandKeyRef.current = currentHandKey;
      } catch (err) {
        console.error("Failed to load personal song hand", err);
      } finally {
        if (mounted) setTracksLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [currentHandKey, isFinalState, isUsersVoteState]);

  useEffect(() => {
    if (!usersList || usersList.length === 0) return;
    let mounted = true;

    const pending = usersList
      .filter((u) => u.my_song_id && u.my_song_id.length > 0)
      .filter((u) => !selectedSongsList.some((s) => s.userId === u.id));

    if (pending.length === 0) return;

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
    const prev = prevGameStateRef.current;
    const next = game?.state;

    if (next === GameState.USERS_VOTE && prev !== GameState.USERS_VOTE) {
      setTimeIsUp(false);
      setSelectedTrack(null);
      votePhaseFinalizeRef.current = false;
    } else if (
      next === GameState.USERS_SELECT &&
      prev !== GameState.USERS_SELECT
    ) {
      setTimeIsUp(false);
      setSelectedTrack(null);
      selectPhaseFinalizeRef.current = false;
    } else if (
      next === GameState.MASTER_SELECTS &&
      prev === GameState.FINAL
    ) {
      resetLocalRound();
    }

    prevGameStateRef.current = next;

    if (next === GameState.USERS_VOTE && id) {
      void refreshUsersForGame(queryClient, gameId);
    }
  }, [game?.state, gameId, id, queryClient, resetLocalRound]);

  useEffect(() => {
    if (game?.state !== GameState.USERS_VOTE) return;
    if (!voteSongIdsKey || loadedVoteKeyRef.current === voteSongIdsKey) return;

    let mounted = true;
    if (loadedVoteKeyRef.current === "") {
      setTracksLoading(true);
    }

    (async () => {
      try {
        const usersWithSong = usersListRef.current.filter(
          (u) => u.my_song_id && u.my_song_id.trim().length > 0,
        );

        if (usersWithSong.length === 0) {
          if (mounted) setTracksLoading(false);
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
        const unique: ISpotifyTrackItem[] = [];
        const seen = new Set<string>();
        const sorted = [...results]
          .filter((t) => t != null && t.id)
          .sort((a, b) => String(a.id).localeCompare(String(b.id)));
        for (const t of sorted) {
          if (seen.has(t.id)) continue;
          seen.add(t.id);
          unique.push(toSpotifyListItem(t));
        }
        setTracks((prev) => (sameTrackList(prev, unique) ? prev : unique));
        loadedVoteKeyRef.current = voteSongIdsKey;
      } catch (err) {
        console.error("Error loading vote-phase tracks:", err);
      } finally {
        if (mounted) setTracksLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [game?.state, voteSongIdsKey]);

  useEffect(() => {
    if (!id || !game?.state) return;

    const masterIdStr = masterId != null ? String(masterId) : null;
    const nonMasterUsers = nonMasterPlayers(usersList, masterIdStr);

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
      if (masterVoted && !waitingForPlayers) {
        void moveToState(GameState.USERS_SELECT);
      }
      return;
    }

    if (game.state === GameState.USERS_SELECT) {
      const allNonMasterSelected =
        nonMasterUsers.length > 0 &&
        nonMasterUsers.every(
          (u) =>
            typeof u.my_song_id === "string" && u.my_song_id.trim().length > 0,
        );

      if (!allNonMasterSelected && !timeIsUp) return;

      const finalizeSelectPhase = async () => {
        if (selectPhaseFinalizeRef.current) return;
        selectPhaseFinalizeRef.current = true;

        if (!allNonMasterSelected) {
          const usersNeedingSong = nonMasterUsers.filter(
            (u) =>
              typeof u.my_song_id !== "string" ||
              u.my_song_id.trim().length === 0,
          );

          if (usersNeedingSong.length > 0) {
            await Promise.all(
              usersNeedingSong.map(async (u) => {
                const pick = randomTrackIdFromPool(
                  parseSongHand(u.song_hand).map((songId) => ({ id: songId })),
                );
                if (!pick) return;
                const { error } = await supabase
                  .from("users")
                  .update({
                    my_song_id: pick,
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

            await refreshUsersForGame(queryClient, gameId);
          }
        }

        await moveToState(GameState.USERS_VOTE);
      };

      void finalizeSelectPhase();
      return;
    }

    if (game.state === GameState.USERS_VOTE) {
      if (!shouldFinalizeVotePhase(usersList, masterIdStr, timeIsUp)) return;

      const completeVotePhase = async () => {
        if (votePhaseFinalizeRef.current) return;
        votePhaseFinalizeRef.current = true;

        setGame((prev) =>
          prev && prev.state === GameState.USERS_VOTE
            ? { ...prev, state: GameState.FINAL }
            : prev,
        );

        try {
          const updated = await finalizeVoteRound({
            gameId: id.toString(),
            masterId: masterIdStr ?? "",
            votePool: tracks,
          });
          if (updated) {
            setGame((prev) =>
              prev
                ? { ...prev, ...updated, state: GameState.FINAL }
                : prev,
            );
            await refreshUsersForGame(queryClient, gameId);
            return;
          }
          votePhaseFinalizeRef.current = false;
        } catch (err) {
          console.error("Failed to finalize vote round", err);
          votePhaseFinalizeRef.current = false;
        }
      };

      void completeVotePhase();
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
    gameId,
    waitingForPlayers,
  ]);

  useEffect(() => {
    if (!id) return;
    if (authLoading) return;
    if (!user) {
      if (window.location.pathname === "/login") return;

      navigate(`/login?returnTo=/game/${id}`);
      return;
    }
    (async () => {
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
            queryClient.setQueryData<IUser[]>(
              usersQueryKey(gameId),
              (prev = []) => mergeUsersLists(prev, users),
            ),
          setIsUserCreated,
          setErrorMessage,
          setCurrentUser,
        });
      }
    })();
  }, [id, user?.id, authLoading, navigate, queryClient]);

  useEffect(() => {
    if (waitingForPlayers && isMasterSelectState) {
      setIsButtonSelectDisabled(true);
      return;
    }

    if (game?.state === GameState.USERS_VOTE) {
      if (isCurrentMaster) {
        setIsButtonSelectDisabled(true);
      } else {
        setIsButtonSelectDisabled(!!currentUser?.master_song_voted);
      }
      return;
    }

    if (isCurrentMaster) {
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
    waitingForPlayers,
    isMasterSelectState,
    isCurrentMaster,
  ]);

  const phaseMessage = (() => {
    if (
      waitingForPlayers &&
      !isUsersSelectState &&
      !isUsersVoteState &&
      !isFinalState
    ) {
      return `Waiting for players (${onlinePlayers.length}/${RECOMMENDED_PLAYERS_MIN} recommended, max ${MAX_PLAYERS}). Share the link to invite friends.`;
    }
    if (isFinalState) return null;
    if (isUsersVoteState) {
      return isCurrentMaster
        ? "Everyone can see all chosen songs, including yours. Players have 2 minutes to vote. You do not vote."
        : "These are everyone’s chosen songs, including the Master’s. Vote for the song you think the Master picked. You cannot vote for your own song.";
    }
    if (isUsersSelectState) {
      return isCurrentMaster
        ? "Say your clue on the phone. Other players are picking a song from their own lists."
        : "Pick 1 song from your list that matches the Master’s clue (said on the phone). You have 2 minutes.";
    }
    if (isMasterSelectState) {
      return isCurrentMaster
        ? "Pick 1 song from your list, then say a clue on the phone. Do not type the clue in the app."
        : "These are your songs. Wait for the Master to pick a song and say a clue on the phone.";
    }
    return null;
  })();

  const showPersonalHand =
    isUserCreated &&
    (isMasterSelectState
      ? !waitingForPlayers
      : Boolean(isUsersSelectState && !isCurrentMaster));
  const showVoteSongs = isUserCreated && isUsersVoteState;
  const showSongs = showPersonalHand || showVoteSongs;

  return (
    <div className="grid w-full grid-cols-1 items-start gap-6 p-4 md:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="relative min-h-[28rem] min-w-0 w-full">
        {errorMessage && <p>{errorMessage}</p>}
        {isFinalState ? (
          <RoundResults
            usersList={usersList}
            masterId={masterId}
            tracksById={tracksById}
            onNextRound={() => void handleNextRound()}
            nextRoundLoading={nextRoundLoading}
          />
        ) : showSongs ? (
          <SongsList
            tracks={tracks}
            isUserCreated={isUserCreated}
            selectedTrack={selectedTrack}
            setSelectedTrack={setSelectedTrack}
            isSelectDisabled={isButtonSelectDisabled}
            timeIsUp={timeIsUp}
            isVotePhase={isUsersVoteState}
            tracksLoading={tracksLoading}
            masterId={masterId}
            currentUser={currentUser}
            onUserSaved={handleUserSaved}
            hideConfirm={isMasterSelectState && !isCurrentMaster}
            confirmLabel={isUsersVoteState ? "Vote" : "Select"}
          />
        ) : (
          <div className="min-h-[28rem]" />
        )}
      </div>
      <aside className="flex w-full flex-col items-center md:w-80">
        {usersList.length > 0 && (
          <PlayersList
            usersList={usersList}
            masterId={masterId}
            gameState={game?.state}
          />
        )}
        <CopyLink />
        {phaseMessage ? <p className={messageStyle}>{phaseMessage}</p> : null}
        {(isUsersSelectState || isUsersVoteState) && game?.timer_started_at ? (
          <Timer
            key={game.state}
            timeSec={GAME_TIMER_DURATION_SEC}
            startedAt={game.timer_started_at}
            onFinish={handleTimerFinish}
          />
        ) : null}
      </aside>
    </div>
  );
};

export default Game;
