import { GAME_TIMER_DURATION_SEC } from "../constants/game";
import { GameState, IGame } from "../api/interface";
import { isTimerExpired } from "./timerMath";

const PHASE_ORDER: Record<GameState, number> = {
  [GameState.MASTER_SELECTS]: 0,
  [GameState.USERS_SELECT]: 1,
  [GameState.USERS_VOTE]: 2,
  [GameState.FINAL]: 3,
};

export function phaseOrder(state: GameState | undefined): number {
  if (!state) return -1;
  return PHASE_ORDER[state] ?? -1;
}

function timerMs(value: string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/** Prefer the original start time so a later poll cannot restart the countdown. */
export function earlierTimerStartedAt(
  prev: string | null | undefined,
  incoming: string | null | undefined,
): string | null | undefined {
  if (!prev) return incoming;
  if (!incoming) return prev;
  return timerMs(prev) <= timerMs(incoming) ? prev : incoming;
}

function laterTimerStartedAt(
  prev: string | null | undefined,
  incoming: string | null | undefined,
): string | null | undefined {
  if (!prev) return incoming;
  if (!incoming) return prev;
  return timerMs(prev) >= timerMs(incoming) ? prev : incoming;
}

/** Keep the original clock unless it already expired and a live one exists. */
export function timerForSamePhase(
  prev: string | null | undefined,
  incoming: string | null | undefined,
  now = Date.now(),
): string | null | undefined {
  const earlier = earlierTimerStartedAt(prev, incoming);
  const later = laterTimerStartedAt(prev, incoming);
  if (
    earlier &&
    later &&
    earlier !== later &&
    isTimerExpired(earlier, GAME_TIMER_DURATION_SEC, now) &&
    !isTimerExpired(later, GAME_TIMER_DURATION_SEC, now)
  ) {
    return later;
  }
  return earlier;
}

function timerForPhase(
  state: GameState,
  timer: string | null | undefined,
): string | null | undefined {
  if (state === GameState.MASTER_SELECTS || state === GameState.FINAL) {
    return null;
  }
  return timer;
}

/** Keep the newest round; never rewind a phase or restart its timer. */
export function mergeIncomingGame(
  prev: IGame | null,
  incoming: IGame,
): IGame {
  const incomingTimed = {
    ...incoming,
    timer_started_at: timerForPhase(incoming.state, incoming.timer_started_at),
  };
  if (!prev) return incomingTimed;

  const prevRound = Number(prev.game_number) || 0;
  const nextRound = Number(incomingTimed.game_number) || 0;
  if (nextRound < prevRound) return prev;
  if (nextRound > prevRound) return incomingTimed;

  const prevPhase = phaseOrder(prev.state);
  const nextPhase = phaseOrder(incomingTimed.state);
  if (nextPhase < prevPhase) return prev;

  if (
    prev.state === GameState.FINAL &&
    incomingTimed.state === GameState.USERS_VOTE
  ) {
    return prev;
  }

  if (nextPhase === prevPhase) {
    const timer_started_at = timerForPhase(
      incomingTimed.state,
      timerForSamePhase(prev.timer_started_at, incomingTimed.timer_started_at),
    );
    if (
      String(prev.master_id) === String(incomingTimed.master_id) &&
      prev.timer_started_at === timer_started_at &&
      prev.scores_applied === incomingTimed.scores_applied
    ) {
      return prev;
    }
    return { ...incomingTimed, timer_started_at };
  }

  return incomingTimed;
}

export function isNewRound(
  prevNumber: number | undefined,
  nextNumber: number | undefined,
): boolean {
  if (nextNumber == null || prevNumber == null) return false;
  return nextNumber > prevNumber;
}
