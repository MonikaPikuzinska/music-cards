import { describe, expect, it } from "vitest";
import { getNextMaster } from "./nextMaster";
import { IUser } from "../api/interface";

const player = (id: string, name: string, is_logged = true): IUser =>
  ({
    id,
    name,
    avatar: "music",
    game_id: "g1",
    my_song_voted: false,
    master_song_voted: false,
    points: 0,
    my_song_id: "",
    master_song_id: "",
    is_logged,
  }) as IUser;

describe("getNextMaster", () => {
  it("passes the Master role alphabetically and wraps around", () => {
    const users = [
      player("3", "Zoe"),
      player("1", "Alex"),
      player("2", "Mia"),
    ];

    expect(getNextMaster(users, "1")?.id).toBe("2");
    expect(getNextMaster(users, "2")?.id).toBe("3");
    expect(getNextMaster(users, "3")?.id).toBe("1");
  });

  it("skips logged-out players when at least two players are still seated", () => {
    const users = [
      player("1", "Alex"),
      player("2", "Mia", false),
      player("3", "Zoe"),
    ];
    expect(getNextMaster(users, "1")?.id).toBe("3");
  });

  it("still rotates when only two players are in the game and one looks logged out", () => {
    const users = [player("1", "Alex"), player("2", "Mia", false)];
    expect(getNextMaster(users, "1")?.id).toBe("2");
  });

  it("picks the first name if the current Master is gone", () => {
    const users = [player("2", "Mia"), player("1", "Alex")];
    expect(getNextMaster(users, "missing")?.id).toBe("1");
  });
});
