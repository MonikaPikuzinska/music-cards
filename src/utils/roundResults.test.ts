import { describe, expect, it } from "vitest";
import { buildRoundResults } from "./roundResults";
import { IUser } from "../api/interface";

const user = (partial: Partial<IUser> & Pick<IUser, "id" | "name">): IUser =>
  ({
    avatar: "music",
    game_id: "g1",
    my_song_voted: true,
    master_song_voted: true,
    points: 0,
    my_song_id: "",
    master_song_id: "",
    is_logged: true,
    ...partial,
  }) as IUser;

describe("buildRoundResults", () => {
  it("shows who submitted each song and who voted for it", () => {
    const users = [
      user({
        id: "m",
        name: "Master",
        my_song_id: "song-m",
        master_song_id: "",
      }),
      user({
        id: "a",
        name: "Alice",
        my_song_id: "song-a",
        master_song_id: "song-m",
      }),
      user({
        id: "b",
        name: "Bob",
        my_song_id: "song-b",
        master_song_id: "song-a",
      }),
    ];

    const rows = buildRoundResults(users, "m");
    const masterRow = rows.find((r) => r.userId === "m");
    const aliceRow = rows.find((r) => r.userId === "a");

    expect(masterRow?.isMasterSong).toBe(true);
    expect(masterRow?.voters.map((v) => v.name)).toEqual(["Alice"]);
    expect(aliceRow?.isMasterSong).toBe(false);
    expect(aliceRow?.voters.map((v) => v.name)).toEqual(["Bob"]);
    expect(aliceRow?.pointsThisRound).toBe(4);
  });
});
