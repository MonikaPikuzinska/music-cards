import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameState, IGame, IUser } from "../api/interface";

const getGameById = vi.fn();
const updateGame = vi.fn();
const updateUser = vi.fn();
const getUsersByGameId = vi.fn();
const saveNextRoundGame = vi.fn();
const applyRoundScoresRpc = vi.fn();

vi.mock("../api/api", () => ({
  getGameById: (...args: unknown[]) => getGameById(...args),
  updateGame: (...args: unknown[]) => updateGame(...args),
  updateUser: (...args: unknown[]) => updateUser(...args),
  getUsersByGameId: (...args: unknown[]) => getUsersByGameId(...args),
  saveNextRoundGame: (...args: unknown[]) => saveNextRoundGame(...args),
  applyRoundScoresRpc: (...args: unknown[]) => applyRoundScoresRpc(...args),
}));

import { startNextRound } from "./roundService";

const user = (id: string, name: string, points = 0): IUser =>
  ({
    id,
    name,
    avatar: "music",
    game_id: "g1",
    my_song_voted: true,
    master_song_voted: id !== "m",
    points,
    my_song_id: `song-${id}`,
    master_song_id: id === "m" ? "" : "song-m",
    is_logged: true,
  }) as IUser;

const game = (state: GameState, extra: Partial<IGame> = {}): IGame =>
  ({
    id: "g1",
    game_number: 1,
    master_id: "m",
    state,
    ...extra,
  }) as IGame;

describe("startNextRound", () => {
  const players = [user("m", "Mina"), user("p", "Piotr")];

  beforeEach(() => {
    getGameById.mockReset().mockResolvedValue(game(GameState.FINAL));
    updateGame.mockReset().mockImplementation(async (_id, updates: Partial<IGame>) => {
      if (updates.state === GameState.MASTER_SELECTS) {
        return [
          game(GameState.MASTER_SELECTS, {
            master_id: "p",
            game_number: 2,
          }),
        ];
      }
      return [game(GameState.FINAL, { scores_applied: true })];
    });
    updateUser.mockReset().mockResolvedValue([]);
    getUsersByGameId.mockReset().mockResolvedValue(players);
    saveNextRoundGame.mockReset().mockResolvedValue(
      game(GameState.MASTER_SELECTS, { master_id: "p", game_number: 2 }),
    );
    applyRoundScoresRpc.mockReset().mockResolvedValue(false);
    getGameById.mockResolvedValue(
      game(GameState.MASTER_SELECTS, { master_id: "p", game_number: 2 }),
    );
  });

  it("starts the next round when the FINAL lock returns no rows", async () => {
    updateGame.mockImplementation(async (_id, updates: Partial<IGame>, match?: Partial<IGame>) => {
      if (match?.state === GameState.FINAL) return [];
      if (updates.state === GameState.MASTER_SELECTS) {
        return [
          game(GameState.MASTER_SELECTS, {
            master_id: "p",
            game_number: 2,
          }),
        ];
      }
      return [game(GameState.FINAL, { scores_applied: true })];
    });

    const next = await startNextRound({
      gameId: "g1",
      users: players,
      currentMasterId: "m",
      gameNumber: 1,
    });

    expect(next?.state).toBe(GameState.MASTER_SELECTS);
    expect(String(next?.master_id)).toBe("p");
    expect(updateUser).toHaveBeenCalled();
  });

  it("rotates the Master even if the database is already in master_selects", async () => {
    getGameById.mockResolvedValue(game(GameState.MASTER_SELECTS));

    const next = await startNextRound({
      gameId: "g1",
      users: players,
      currentMasterId: "m",
      gameNumber: 1,
    });

    expect(next?.state).toBe(GameState.MASTER_SELECTS);
    expect(String(next?.master_id)).toBe("p");
    expect(updateGame).toHaveBeenCalled();
  });

  it("advances even if the database is still in the vote phase", async () => {
    getGameById.mockResolvedValue(game(GameState.USERS_VOTE));

    const next = await startNextRound({
      gameId: "g1",
      users: players,
      currentMasterId: "m",
      gameNumber: 1,
    });

    expect(next?.state).toBe(GameState.MASTER_SELECTS);
    expect(String(next?.master_id)).toBe("p");
  });

  it("writes missing round points before resetting players", async () => {
    await startNextRound({
      gameId: "g1",
      users: players,
      currentMasterId: "m",
      gameNumber: 1,
    });

    expect(updateUser).toHaveBeenCalledWith(
      "p",
      expect.objectContaining({ points: 2 }),
    );
  });

  it("clears song ids and voted flags for every player", async () => {
    await startNextRound({
      gameId: "g1",
      users: players,
      currentMasterId: "m",
      gameNumber: 1,
    });

    const pickReset = {
      my_song_id: "",
      master_song_id: "",
      my_song_voted: false,
      master_song_voted: false,
    };
    expect(updateUser).toHaveBeenCalledWith("m", expect.objectContaining(pickReset));
    expect(updateUser).toHaveBeenCalledWith("p", expect.objectContaining(pickReset));
  });

  it("does not start the next round unless the new Master is stored", async () => {
    saveNextRoundGame.mockResolvedValue(null);
    getGameById.mockResolvedValue(
      game(GameState.MASTER_SELECTS, { master_id: "m", game_number: 1 }),
    );

    const next = await startNextRound({
      gameId: "g1",
      users: players,
      currentMasterId: "m",
      gameNumber: 1,
    });

    expect(next).toBeNull();
    expect(saveNextRoundGame).toHaveBeenCalledWith({
      gameId: "g1",
      masterId: "p",
      gameNumber: 2,
    });
  });
});
