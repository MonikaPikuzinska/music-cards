import { describe, expect, it } from "vitest";
import { GameState, IUser } from "../../api/interface";
import { shouldShowVotedCheck } from "./PlayersList";

const user = (partial: Partial<IUser>): IUser =>
  ({
    id: "u1",
    name: "Ada",
    avatar: "music",
    game_id: "g1",
    my_song_voted: false,
    master_song_voted: false,
    points: 0,
    my_song_id: "",
    master_song_id: "",
    is_logged: true,
    ...partial,
  }) as IUser;

describe("shouldShowVotedCheck", () => {
  it("uses my_song_voted during selection", () => {
    const u = user({ my_song_voted: true, master_song_voted: false });
    expect(shouldShowVotedCheck(u, GameState.MASTER_SELECTS, "m")).toBe(true);
    expect(shouldShowVotedCheck(u, GameState.USERS_SELECT, "m")).toBe(true);
  });

  it("uses master_song_voted during voting and hides the Master check", () => {
    const voter = user({
      id: "p1",
      my_song_voted: true,
      master_song_voted: true,
    });
    const master = user({
      id: "m",
      my_song_voted: true,
      master_song_voted: false,
    });
    expect(shouldShowVotedCheck(voter, GameState.USERS_VOTE, "m")).toBe(true);
    expect(shouldShowVotedCheck(master, GameState.USERS_VOTE, "m")).toBe(false);
  });
});
