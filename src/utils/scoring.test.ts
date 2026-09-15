import { describe, expect, it } from "vitest";
import { calculateRoundScores } from "./scoring";
import { IUser } from "../api/interface";

const user = (
  partial: Partial<IUser> & Pick<IUser, "id" | "my_song_id" | "master_song_id">,
): IUser =>
  ({
    name: String(partial.id),
    avatar: "music",
    my_song_voted: true,
    master_song_voted: true,
    points: 0,
    game_id: "g1",
    is_logged: true,
    ...partial,
  }) as IUser;

describe("calculateRoundScores", () => {
  it("gives Master 3, correct guessers 3, and +1 per vote on a decoy when some but not all guess", () => {
    const master = user({ id: "m", my_song_id: "song-m", master_song_id: "" });
    const alice = user({
      id: "a",
      my_song_id: "song-a",
      master_song_id: "song-m",
    });
    const bob = user({
      id: "b",
      my_song_id: "song-b",
      master_song_id: "song-a",
    });
    const cara = user({
      id: "c",
      my_song_id: "song-c",
      master_song_id: "song-a",
    });

    const scores = calculateRoundScores([master, alice, bob, cara], "m");

    expect(scores.m).toBe(3);
    expect(scores.a).toBe(5); // 3 for guessing + 2 votes on her decoy
    expect(scores.b).toBe(0);
    expect(scores.c).toBe(0);
  });

  it("gives Master 0 and everyone else 2 when nobody guesses", () => {
    const master = user({ id: "m", my_song_id: "song-m", master_song_id: "" });
    const alice = user({
      id: "a",
      my_song_id: "song-a",
      master_song_id: "song-b",
    });
    const bob = user({
      id: "b",
      my_song_id: "song-b",
      master_song_id: "song-a",
    });

    const scores = calculateRoundScores([master, alice, bob], "m");

    expect(scores.m).toBe(0);
    expect(scores.a).toBe(2);
    expect(scores.b).toBe(2);
  });

  it("gives Master 0 and everyone else 2 when everyone guesses", () => {
    const master = user({ id: "m", my_song_id: "song-m", master_song_id: "" });
    const alice = user({
      id: "a",
      my_song_id: "song-a",
      master_song_id: "song-m",
    });
    const bob = user({
      id: "b",
      my_song_id: "song-b",
      master_song_id: "song-m",
    });

    const scores = calculateRoundScores([master, alice, bob], "m");

    expect(scores.m).toBe(0);
    expect(scores.a).toBe(2);
    expect(scores.b).toBe(2);
  });

  it("returns zeros when the Master is missing", () => {
    const alice = user({
      id: "a",
      my_song_id: "song-a",
      master_song_id: "song-m",
    });
    expect(calculateRoundScores([alice], "m")).toEqual({ a: 0 });
  });
});
