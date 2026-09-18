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
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getGameById, getUsersByGameId, updateGame, updateUser } from "../../api/api";
import { useGamePresence } from "../../hooks/useGamePresence";
import Timer from "../../components/Timer/Timer";
import { toBool } from "../../utils/toBool";
import {
  applyUsersRealtimeToCache,
  isStaleLastRoundUser,
  mergeUsersLists,
  patchUserInCache,
  refreshUsersForGame,
  snapshotUsersForRoundReset,
  usersQueryKey,
} from "../../utils/usersQueryCache";
import { toSpotifyListItem, sameTrackList } from "../../utils/spotifyTrack";
import { isTimerExpired } from "../../utils/timerMath";
import { isLoggedIn } from "../../utils/isLoggedIn";
import { randomTrackIdFromPool } from "../../utils/canVoteForTrack";
import {
  GAME_TIMER_DURATION_SEC,
  HAND_SIZE,
  MIN_PLAYERS_TO_START,
  RECOMMENDED_PLAYERS_MIN,
  MAX_PLAYERS,
} from "../../constants/game";
import {
  finalizeVoteRound,
  NEXT_ROUND_USER_RESET,
  startNextRound,
} from "../../services/roundService";
import {
  parseSongHand,
  pickUniqueHand,
  usedSongIdsFromUsers,
  songHandSaveErrorMessage,
  masterPickedFromHand,
} from "../../utils/songHand";
import { nonMasterPlayers, shouldFinalizeVotePhase } from "../../utils/votePhase";
import { isNewRound, mergeIncomingGame, phaseOrder } from "../../utils/mergeIncomingGame";
import { shouldShowPersonalHand } from "../../utils/personalHand";
import { calculateRoundScores } from "../../utils/scoring";

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
  const prevGameNumberRef = useRef<number | undefined>(undefined);
  const gameSyncChannelRef = useRef<RealtimeChannel | null>(null);
  const selectPhaseFinalizeRef = useRef(false);
  const votePhaseFinalizeRef = useRef(false);
  const scoresAppliedRoundRef = useRef<number | null>(null);
  const timeUpPhaseRef = useRef<GameState | null>(null);
  const loadedHandKeyRef = useRef("");
  const loadedVoteKeyRef = useRef("");
  const needsNewHandRef = useRef(false);
  const usersListRef = useRef(usersList);
  usersListRef.current = usersList;
  const gameRef = useRef(game);
  gameRef.current = game;

  const handleTimerFinish = useCallback(() => {
    const state = gameRef.current?.state;
    if (
      state === GameState.USERS_SELECT ||
      state === GameState.USERS_VOTE
    ) {
      timeUpPhaseRef.current = state;
      setTimeIsUp(true);
    }
  }, []);

  const addRoundScoresToCache = useCallback(
    (users: IUser[], scoringMasterId: string, roundNumber: number) => {
      if (!gameId) return;
      if (scoresAppliedRoundRef.current === roundNumber) return;
      const hasPicks = users.some(
        (u) =>
          (u.my_song_id || "").trim().length > 0 ||
          (u.master_song_id || "").trim().length > 0,
      );
      if (!hasPicks) return;
      scoresAppliedRoundRef.current = roundNumber;
      const deltas = calculateRoundScores(users, scoringMasterId);
      for (const u of users) {
        const add = deltas[String(u.id)] ?? 0;
        if (add <= 0) continue;
        patchUserInCache(queryClient, gameId, String(u.id), {
          points: (Number(u.points) || 0) + add,
        });
      }
    },
    [gameId, queryClient],
  );

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
    setTracksLoading(false);
    setTimeIsUp(false);
    timeUpPhaseRef.current = null;
    setCurrentUser((prev) =>
      prev ? { ...prev, ...NEXT_ROUND_USER_RESET } : prev,
    );
    selectPhaseFinalizeRef.current = false;
    votePhaseFinalizeRef.current = false;
    loadedHandKeyRef.current = "";
    loadedVoteKeyRef.current = "";
    needsNewHandRef.current = true;
  }, []);

  const appliedRoundResetRef = useRef<number | undefined>(undefined);

  const applyRoundReset = useCallback(
    (roundNumber: number) => {
      if (appliedRoundResetRef.current === roundNumber) return;
      appliedRoundResetRef.current = roundNumber;
      const cached =
        queryClient.getQueryData<IUser[]>(usersQueryKey(gameId)) ?? [];
      const finishedRound = Math.max(1, roundNumber - 1);
      addRoundScoresToCache(
        cached,
        String(gameRef.current?.master_id ?? ""),
        finishedRound,
      );
      resetLocalRound();
      snapshotUsersForRoundReset(cached);
      for (const u of cached) {
        patchUserInCache(
          queryClient,
          gameId,
          String(u.id),
          NEXT_ROUND_USER_RESET,
        );
      }
      void refreshUsersForGame(queryClient, gameId);
    },
    [addRoundScoresToCache, gameId, queryClient, resetLocalRound],
  );

  const applyIncomingGame = useCallback(
    (incoming: IGame) => {
      const prev = gameRef.current;
      const merged = mergeIncomingGame(prev, incoming);
      if (
        isNewRound(prev?.game_number, merged.game_number) ||
        (merged.state === GameState.MASTER_SELECTS &&
          prev?.state === GameState.FINAL)
      ) {
        applyRoundReset(Number(merged.game_number) || 0);
      }
      setGame(merged);
    },
    [applyRoundReset],
  );

  const handleNextRound = useCallback(async () => {
    if (!gameId || masterId == null) return;
    setNextRoundLoading(true);
    setErrorMessage(null);
    try {
      addRoundScoresToCache(
        usersList,
        String(masterId),
        Number(game?.game_number) || 1,
      );
      const next = await startNextRound({
        gameId,
        users: usersList,
        currentMasterId: String(masterId),
        gameNumber: game?.game_number ?? 1,
      });
      if (!next) {
        setErrorMessage(
          "Could not save the new Master in the database. In the Supabase SQL Editor run the start_next_round migration, then try Next round again.",
        );
        return;
      }
      applyIncomingGame(next);
      if (next.master_id) setMasterId(next.master_id);
      void gameSyncChannelRef.current?.send({
        type: "broadcast",
        event: "next_round",
        payload: next,
      });
    } catch (err) {
      console.error("Failed to start next round", err);
      setErrorMessage("Could not start the next round. Try again.");
    } finally {
      setNextRoundLoading(false);
    }
  }, [
    applyIncomingGame,
    addRoundScoresToCache,
    game?.game_number,
    gameId,
    masterId,
    usersList,
  ]);

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
  const masterRow = usersList.find(
    (u) => String(u.id) === String(masterId ?? ""),
  );
  const masterHasPickedThisRound =
    masterPickedFromHand(masterRow) && !isStaleLastRoundUser(masterRow);

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
    const pollUsers = window.setInterval(() => {
      void refreshUsersForGame(queryClient, gameId);
    }, 8_000);
    const pollGameMs = game?.state === GameState.FINAL ? 2_000 : 4_000;
    const pollGame = window.setInterval(() => {
      void getGameById(gameId)
        .then((fetched) => applyIncomingGame(fetched))
        .catch((err) => console.error("Failed to poll game", err));
    }, pollGameMs);
    return () => {
      window.clearInterval(pollUsers);
      window.clearInterval(pollGame);
    };
  }, [applyIncomingGame, game?.state, gameId, queryClient]);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      try {
        const fetched = await getGameById(id.toString());
        if (mounted) applyIncomingGame(fetched);
      } catch (err) {
        console.error("Failed to fetch game", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [applyIncomingGame, id]);

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
      .channel(`game-sync-${gameId}`, {
        config: { broadcast: { ack: true } },
      })
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
          applyIncomingGame(newRec);
        },
      )
      .on("broadcast", { event: "next_round" }, ({ payload }) => {
        const incoming = payload as IGame | null;
        if (!incoming?.state) return;
        applyIncomingGame(incoming);
      })
      .on("broadcast", { event: "game_state" }, ({ payload }) => {
        const incoming = payload as IGame | null;
        if (!incoming?.state) return;
        applyIncomingGame(incoming);
      })
      .subscribe();

    gameSyncChannelRef.current = gameSub;

    return () => {
      gameSyncChannelRef.current = null;
      supabase.removeChannel(usersSub);
      supabase.removeChannel(gameSub);
    };
  }, [applyIncomingGame, gameId, queryClient]);

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
    const masterHasPicked = masterPickedFromHand(masterRow);
    setMasterVoted(masterHasPicked);
  }, [usersList, masterId]);

  // Deal this player a unique 6-song hand that does not overlap with anyone else.
  useEffect(() => {
    if (!isUserCreated || !currentUser || !gameId) return;
    if (isUsersVoteState || isFinalState) return;
    const existing = parseSongHand(currentUser.song_hand);
    if (existing.length >= HAND_SIZE && !needsNewHandRef.current) return;

    const userId = String(currentUser.id);
    let cancelled = false;

    (async () => {
      try {
        const latest = await getUsersByGameId(gameId);
        if (cancelled) return;
        const me = latest.find((u) => String(u.id) === userId);
        const alreadyDealt = parseSongHand(me?.song_hand);
        if (alreadyDealt.length >= HAND_SIZE && !needsNewHandRef.current) {
          handleUserSaved(userId, { song_hand: alreadyDealt });
          return;
        }
        const used = usedSongIdsFromUsers(latest, userId);
        const pool = await fetchUnusedSpotifyTracks(used, HAND_SIZE + 18);
        if (cancelled) return;
        const ids = pickUniqueHand(pool, used, HAND_SIZE);
        if (ids.length < HAND_SIZE) {
          if (ids.length === 0) {
            setErrorMessage("Could not deal unique songs. Try refreshing.");
          }
          return;
        }
        await updateUser(userId, { song_hand: ids });
        if (cancelled) return;
        needsNewHandRef.current = false;
        handleUserSaved(userId, { song_hand: ids });
        setErrorMessage((prev) =>
          prev && /song list|song_hand|schema cache/i.test(prev) ? null : prev,
        );
      } catch (err) {
        console.error("Failed to deal song hand", err);
        if (!cancelled) setErrorMessage(songHandSaveErrorMessage(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    currentHandKey,
    currentUser?.id,
    game?.game_number,
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
    const prevNumber = prevGameNumberRef.current;
    const nextNumber = game?.game_number;

    if (next === GameState.USERS_VOTE && prev !== GameState.USERS_VOTE) {
      timeUpPhaseRef.current = null;
      setTimeIsUp(false);
      setSelectedTrack(null);
      votePhaseFinalizeRef.current = false;
      loadedVoteKeyRef.current = "";
      setTracks([]);
    } else if (
      next === GameState.USERS_SELECT &&
      prev !== GameState.USERS_SELECT
    ) {
      timeUpPhaseRef.current = null;
      setTimeIsUp(false);
      setSelectedTrack(null);
      selectPhaseFinalizeRef.current = false;
    }

    if (
      isNewRound(prevNumber, nextNumber) ||
      (next === GameState.MASTER_SELECTS && prev === GameState.FINAL)
    ) {
      applyRoundReset(Number(nextNumber) || 0);
    }

    prevGameStateRef.current = next;
    if (nextNumber != null) prevGameNumberRef.current = nextNumber;

    if (next === GameState.USERS_VOTE && id) {
      void refreshUsersForGame(queryClient, gameId);
    }
  }, [applyRoundReset, game?.game_number, game?.state, gameId, id, queryClient]);

  useEffect(() => {
    if (game?.state !== GameState.USERS_VOTE) return;
    if (!voteSongIdsKey || loadedVoteKeyRef.current === voteSongIdsKey) return;

    let mounted = true;
    if (loadedVoteKeyRef.current === "") {
      setTracksLoading(true);
    }

    (async () => {
      try {
        const songIds = [
          ...new Set(
            usersListRef.current
              .map((u) => (u.my_song_id || "").trim())
              .filter(Boolean),
          ),
        ];

        if (songIds.length === 0) {
          if (mounted) setTracksLoading(false);
          return;
        }

        const fetched = await getSpotifyTracksByIds(songIds);
        if (!mounted) return;

        const unique: ISpotifyTrackItem[] = [];
        const seen = new Set<string>();
        const wanted = new Set(songIds);
        for (const t of fetched) {
          if (!t?.id || seen.has(t.id)) continue;
          seen.add(t.id);
          unique.push(toSpotifyListItem(t));
        }

        setTracks((prev) => {
          const byId = new Map<string, ISpotifyTrackItem>();
          for (const t of prev) {
            if (t.id && wanted.has(t.id)) byId.set(t.id, t);
          }
          for (const t of unique) byId.set(t.id, t);
          const next = [...byId.values()].sort((a, b) =>
            String(a.id).localeCompare(String(b.id)),
          );
          return sameTrackList(prev, next) ? prev : next;
        });
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
      const current = game.state;
      if (current === nextState) return;
      if (phaseOrder(current) > phaseOrder(nextState)) return;

      const isTimed =
        nextState === GameState.USERS_SELECT ||
        nextState === GameState.USERS_VOTE;

      const updates: Partial<IGame> = { state: nextState };
      if (isTimed) {
        updates.timer_started_at = new Date().toISOString();
      } else if (nextState === GameState.MASTER_SELECTS) {
        updates.timer_started_at = null;
      }

      try {
        let updated = await updateGame(id.toString(), updates, {
          state: current,
          game_number: game.game_number,
        });
        if (updated.length === 0) {
          updated = await updateGame(id.toString(), updates, {
            state: current,
          });
        }
        const row =
          updated[0] ??
          ({
            ...game,
            ...updates,
          } as IGame);
        const nextRow =
          isTimed &&
          isTimerExpired(row.timer_started_at, GAME_TIMER_DURATION_SEC)
            ? { ...row, timer_started_at: new Date().toISOString() }
            : row;
        if (
          nextRow.timer_started_at &&
          nextRow.timer_started_at !== row.timer_started_at
        ) {
          void updateGame(id.toString(), {
            timer_started_at: nextRow.timer_started_at,
          });
        }

        timeUpPhaseRef.current = null;
        if (isTimed) setTimeIsUp(false);
        applyIncomingGame(nextRow);
        void gameSyncChannelRef.current?.send({
          type: "broadcast",
          event: "game_state",
          payload: nextRow,
        });
      } catch (err) {
        console.error(`Failed to update game state to ${nextState}`, err);
      }
    };

    if (game.state === GameState.MASTER_SELECTS) {
      if (masterHasPickedThisRound && !waitingForPlayers) {
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

      const selectTimedOut =
        timeIsUp && timeUpPhaseRef.current === GameState.USERS_SELECT;
      if (!allNonMasterSelected && !selectTimedOut) return;

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
                const patch: Partial<IUser> = {
                  my_song_id: pick,
                  my_song_voted: true,
                  master_song_id: "",
                  master_song_voted: false,
                };
                try {
                  await updateUser(String(u.id), patch);
                  handleUserSaved(String(u.id), patch);
                  if (String(currentUser?.id) === String(u.id)) {
                    setCurrentUser((prev) =>
                      prev ? { ...prev, ...patch } : prev,
                    );
                  }
                } catch (err) {
                  console.error(
                    "Failed to auto-assign my_song_id on timeout for user",
                    u.id,
                    err,
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
      const voteTimedOut =
        timeIsUp && timeUpPhaseRef.current === GameState.USERS_VOTE;
      if (!shouldFinalizeVotePhase(usersList, masterIdStr, voteTimedOut)) {
        return;
      }

      const showVoteResults = (row: IGame) => {
        applyIncomingGame({
          ...row,
          state: GameState.FINAL,
          timer_started_at: null,
        });
        void gameSyncChannelRef.current?.send({
          type: "broadcast",
          event: "game_state",
          payload: {
            ...row,
            state: GameState.FINAL,
            timer_started_at: null,
          },
        });
      };

      const completeVotePhase = async () => {
        if (votePhaseFinalizeRef.current) return;
        votePhaseFinalizeRef.current = true;

        const localFinal: IGame = {
          ...(gameRef.current ?? game),
          state: GameState.FINAL,
          timer_started_at: null,
        };
        showVoteResults(localFinal);
        addRoundScoresToCache(
          usersListRef.current,
          masterIdStr ?? "",
          Number(game.game_number) || 1,
        );

        try {
          const updated = await finalizeVoteRound({
            gameId: id.toString(),
            masterId: masterIdStr ?? "",
            votePool: tracks,
            fallbackUsers: usersList,
          });
          if (updated) {
            showVoteResults(updated);
            await refreshUsersForGame(queryClient, gameId);
            return;
          }
          const forced = await updateGame(id.toString(), {
            state: GameState.FINAL,
            timer_started_at: null,
          });
          if (forced[0]) {
            showVoteResults(forced[0]);
            await refreshUsersForGame(queryClient, gameId);
            return;
          }
        } catch (err) {
          console.error("Failed to finalize vote round", err);
        } finally {
          votePhaseFinalizeRef.current = false;
        }
      };

      void completeVotePhase();
    }
  }, [
    id,
    game?.state,
    game?.game_number,
    timeIsUp,
    usersList,
    masterId,
    tracks,
    currentUser,
    queryClient,
    gameId,
    waitingForPlayers,
    applyIncomingGame,
    addRoundScoresToCache,
    handleUserSaved,
    masterHasPickedThisRound,
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

    if (isMasterSelectState) {
      setIsButtonSelectDisabled(
        isCurrentMaster ? masterPickedFromHand(currentUser) : true,
      );
      return;
    }

    if (isUsersSelectState) {
      setIsButtonSelectDisabled(
        isCurrentMaster
          ? masterPickedFromHand(currentUser)
          : !!currentUser?.my_song_voted || !masterHasPickedThisRound,
      );
      return;
    }

    setIsButtonSelectDisabled(true);
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
    isUsersSelectState,
    isCurrentMaster,
    masterHasPickedThisRound,
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

  const showPersonalHand = shouldShowPersonalHand({
    isUserCreated,
    isMasterSelectState,
    isUsersSelectState,
    isCurrentMaster,
    masterHasPickedThisRound: masterPickedFromHand(currentUser),
  });
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
            tracksLoading={
              tracks.length === 0 &&
              (showPersonalHand || (showVoteSongs && tracksLoading))
            }
            masterId={masterId}
            currentUser={currentUser}
            onUserSaved={handleUserSaved}
            hideConfirm={
              isUsersVoteState
                ? isCurrentMaster
                : isUsersSelectState
                  ? isCurrentMaster
                    ? masterPickedFromHand(currentUser)
                    : !masterHasPickedThisRound
                  : !isCurrentMaster
            }
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
        {(isUsersVoteState ||
          (isUsersSelectState && masterHasPickedThisRound)) &&
        game?.timer_started_at ? (
          <Timer
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
