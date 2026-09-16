import { describe, expect, it } from "vitest";
import {
  handsAreUnique,
  masterHasSubmittedPick,
  masterPickedFromHand,
  parseSongHand,
  pickUniqueHand,
  songHandSaveErrorMessage,
  usedSongIdsFromUsers,
} from "./songHand";
import { IUser } from "../api/interface";

const user = (id: string, song_hand: string[]): IUser =>
  ({
    id,
    name: id,
    avatar: "music",
    game_id: "g1",
    my_song_voted: false,
    master_song_voted: false,
    points: 0,
    my_song_id: "",
    master_song_id: "",
    is_logged: true,
    song_hand,
  }) as IUser;

describe("songHand", () => {
  it("parses arrays, json, and postgres literals", () => {
    expect(parseSongHand(["a", "b"])).toEqual(["a", "b"]);
    expect(parseSongHand('["a","b"]')).toEqual(["a", "b"]);
    expect(parseSongHand("{a,b}")).toEqual(["a", "b"]);
  });

  it("treats a leftover pick as not this round’s Master choice", () => {
    expect(
      masterPickedFromHand({
        my_song_id: "old-pick",
        my_song_voted: true,
        song_hand: ["new-a", "new-b", "new-c", "new-d", "new-e", "new-f"],
      }),
    ).toBe(false);
    expect(
      masterPickedFromHand({
        my_song_id: "new-a",
        my_song_voted: true,
        song_hand: ["new-a", "new-b", "new-c", "new-d", "new-e", "new-f"],
      }),
    ).toBe(true);
  });

  it("does not count a leftover pick while the new hand is still empty", () => {
    expect(
      masterPickedFromHand({
        my_song_id: "song-m",
        my_song_voted: true,
        song_hand: [],
      }),
    ).toBe(false);
    expect(
      masterHasSubmittedPick({
        my_song_id: "song-m",
        my_song_voted: true,
        song_hand: [],
      }),
    ).toBe(true);
  });

  it("deals a hand that does not overlap with songs already used", () => {
    const used = new Set(["t1", "t2"]);
    const pool = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"].map((id) => ({
      id,
    }));
    const hand = pickUniqueHand(pool, used, 6);
    expect(hand).toEqual(["t3", "t4", "t5", "t6", "t7", "t8"]);
    expect(hand.some((id) => used.has(id))).toBe(false);
  });

  it("keeps every player's list unique", () => {
    const users = [
      user("a", ["s1", "s2", "s3", "s4", "s5", "s6"]),
      user("b", ["s7", "s8", "s9", "s10", "s11", "s12"]),
    ];
    expect(handsAreUnique(users)).toBe(true);
    expect(usedSongIdsFromUsers(users, "b").has("s1")).toBe(true);
    expect(usedSongIdsFromUsers(users, "b").has("s7")).toBe(false);

    const overlapping = [user("a", ["s1"]), user("b", ["s1"])];
    expect(handsAreUnique(overlapping)).toBe(false);
  });

  it("explains a stale Supabase schema cache instead of a missing column", () => {
    expect(
      songHandSaveErrorMessage(
        new Error(
          "Could not find the 'song_hand' column of 'users' in the schema cache",
        ),
      ),
    ).toMatch(/NOTIFY pgrst, 'reload schema'/);
  });
});
