import { describe, expect, it } from "vitest";
import { GameState, IGame } from "../api/interface";
import { gameReflectsUpdates, isNextRoundApplied } from "./gameUpdate";

const game = (extra: Partial<IGame> = {}): IGame =>
  ({
    id: "g1",
    game_number: 1,
    master_id: "m",
    state: GameState.MASTER_SELECTS,
    ...extra,
  }) as IGame;

describe("gameReflectsUpdates", () => {
  it("rejects a row that still has the previous Master", () => {
    expect(
      gameReflectsUpdates(game(), {
        state: GameState.MASTER_SELECTS,
        master_id: "p",
        game_number: 2,
      }),
    ).toBe(false);
  });

  it("accepts a row that stored the next-round Master and number", () => {
    expect(
      gameReflectsUpdates(
        game({
          master_id: "p",
          game_number: 2,
          timer_started_at: null,
        }),
        {
          state: GameState.MASTER_SELECTS,
          master_id: "p",
          game_number: 2,
          timer_started_at: null,
        },
      ),
    ).toBe(true);
  });

  it("does not treat a leftover timer as a failed next-round write", () => {
    expect(
      gameReflectsUpdates(
        game({
          master_id: "p",
          game_number: 2,
          timer_started_at: "2026-09-16T10:00:00.000Z",
        }),
        {
          state: GameState.MASTER_SELECTS,
          master_id: "p",
          game_number: 2,
          timer_started_at: null,
        },
      ),
    ).toBe(true);
  });

  it("rejects a leftover timer after we asked only to clear it", () => {
    expect(
      gameReflectsUpdates(
        game({ timer_started_at: "2026-09-16T10:00:00.000Z" }),
        { timer_started_at: null },
      ),
    ).toBe(false);
  });
});

describe("isNextRoundApplied", () => {
  it("is true only when master, round number, and phase all match", () => {
    const payload = {
      state: GameState.MASTER_SELECTS,
      master_id: "p",
      game_number: 2,
    };
    expect(isNextRoundApplied(game({ master_id: "m" }), payload)).toBe(false);
    expect(
      isNextRoundApplied(
        game({
          master_id: "p",
          game_number: 2,
          state: GameState.MASTER_SELECTS,
        }),
        payload,
      ),
    ).toBe(true);
  });
});
