import { describe, expect, it } from "vitest";
import { canVoteForTrack, randomTrackIdFromPool } from "./canVoteForTrack";

describe("canVoteForTrack", () => {
  it("blocks voting for your own submitted song", () => {
    expect(canVoteForTrack("abc", "abc")).toBe(false);
    expect(canVoteForTrack("abc", " xyz ")).toBe(true);
    expect(canVoteForTrack("abc", "")).toBe(true);
    expect(canVoteForTrack("", "abc")).toBe(false);
  });
});

describe("randomTrackIdFromPool", () => {
  it("never returns the excluded song when other options exist", () => {
    const pool = [{ id: "mine" }, { id: "other" }];
    for (let i = 0; i < 20; i += 1) {
      expect(randomTrackIdFromPool(pool, "mine")).toBe("other");
    }
  });

  it("falls back to the only song if everything is excluded", () => {
    expect(randomTrackIdFromPool([{ id: "mine" }], "mine")).toBe("mine");
  });
});
