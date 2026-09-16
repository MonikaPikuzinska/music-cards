import { describe, expect, it } from "vitest";
import { GameState, IGame } from "../api/interface";
import { isNewRound, mergeIncomingGame } from "./mergeIncomingGame";

const game = (state: GameState, game_number: number): IGame =>
  ({
    id: "g1",
    game_number,
    master_id: "m",
    state,
  }) as IGame;

describe("mergeIncomingGame", () => {
  it("adopts the next Master when the round number increases", () => {
    const next = mergeIncomingGame(
      { ...game(GameState.FINAL, 1), master_id: "m" },
      { ...game(GameState.MASTER_SELECTS, 2), master_id: "p" },
    );
    expect(next.state).toBe(GameState.MASTER_SELECTS);
    expect(String(next.master_id)).toBe("p");
    expect(next.game_number).toBe(2);
  });

  it("adopts the next round even if this client is still on results", () => {
    const next = mergeIncomingGame(
      game(GameState.FINAL, 1),
      game(GameState.MASTER_SELECTS, 2),
    );
    expect(next.state).toBe(GameState.MASTER_SELECTS);
    expect(next.game_number).toBe(2);
  });

  it("ignores a stale vote-phase event after results", () => {
    const next = mergeIncomingGame(
      game(GameState.FINAL, 1),
      game(GameState.USERS_VOTE, 1),
    );
    expect(next.state).toBe(GameState.FINAL);
  });

  it("does not rewind select back to master_selects in the same round", () => {
    const current = {
      ...game(GameState.USERS_SELECT, 1),
      timer_started_at: "2026-09-15T12:00:00.000Z",
    };
    const stale = game(GameState.MASTER_SELECTS, 1);
    expect(mergeIncomingGame(current, stale).state).toBe(
      GameState.USERS_SELECT,
    );
  });

  it("uses the vote-phase timer when advancing from select", () => {
    const current = {
      ...game(GameState.USERS_SELECT, 1),
      timer_started_at: "2026-09-15T12:00:00.000Z",
    };
    const next = mergeIncomingGame(current, {
      ...game(GameState.USERS_VOTE, 1),
      timer_started_at: "2026-09-15T12:02:00.000Z",
    });
    expect(next.state).toBe(GameState.USERS_VOTE);
    expect(next.timer_started_at).toBe("2026-09-15T12:02:00.000Z");
  });

  it("keeps the original timer when a later snapshot starts a new clock", () => {
    const current = {
      ...game(GameState.USERS_SELECT, 1),
      timer_started_at: "2026-09-15T12:00:00.000Z",
    };
    const polled = {
      ...game(GameState.USERS_SELECT, 1),
      timer_started_at: "2026-09-15T12:00:04.000Z",
    };
    expect(mergeIncomingGame(current, polled).timer_started_at).toBe(
      "2026-09-15T12:00:00.000Z",
    );
  });

  it("does not replace a live vote timer with an expired select leftover", () => {
    const now = Date.now();
    const liveVote = {
      ...game(GameState.USERS_VOTE, 1),
      timer_started_at: new Date(now - 30_000).toISOString(),
    };
    const staleSelect = {
      ...game(GameState.USERS_VOTE, 1),
      timer_started_at: new Date(now - 150_000).toISOString(),
    };
    expect(mergeIncomingGame(liveVote, staleSelect).timer_started_at).toBe(
      liveVote.timer_started_at,
    );
  });

  it("clears the timer when a new round is in master_selects", () => {
    const prev = {
      ...game(GameState.USERS_VOTE, 1),
      timer_started_at: "2026-09-15T12:00:00.000Z",
    };
    const next = mergeIncomingGame(prev, {
      ...game(GameState.MASTER_SELECTS, 2),
      timer_started_at: "2026-09-15T12:00:00.000Z",
    });
    expect(next.state).toBe(GameState.MASTER_SELECTS);
    expect(next.timer_started_at).toBeNull();
  });
});

describe("isNewRound", () => {
  it("is true only when the round number increases", () => {
    expect(isNewRound(1, 2)).toBe(true);
    expect(isNewRound(2, 2)).toBe(false);
    expect(isNewRound(undefined, 1)).toBe(false);
  });
});
