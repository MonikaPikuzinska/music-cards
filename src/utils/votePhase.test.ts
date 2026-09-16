import { describe, expect, it } from "vitest";
import { IUser } from "../api/interface";
import {
  allNonMastersVoted,
  shouldFinalizeVotePhase,
} from "./votePhase";

const user = (partial: Partial<IUser> & Pick<IUser, "id">): IUser =>
  ({
    name: String(partial.id),
    avatar: "music",
    game_id: "g1",
    my_song_voted: true,
    master_song_voted: false,
    points: 0,
    my_song_id: "s",
    master_song_id: "",
    is_logged: true,
    ...partial,
  }) as IUser;

describe("votePhase", () => {
  it("ends the vote as soon as the only regular player has voted", () => {
    const users = [
      user({ id: "m" }),
      user({ id: "p", master_song_voted: true, master_song_id: "song-m" }),
    ];
    expect(allNonMastersVoted(users, "m")).toBe(true);
    expect(shouldFinalizeVotePhase(users, "m", false)).toBe(true);
  });

  it("does not wait for logged-out extra players", () => {
    const users = [
      user({ id: "m" }),
      user({
        id: "p",
        master_song_voted: true,
        master_song_id: "song-m",
      }),
      user({ id: "ghost", is_logged: false, master_song_voted: false }),
    ];
    expect(shouldFinalizeVotePhase(users, "m", false)).toBe(true);
  });

  it("does not wait for players who never submitted a song this round", () => {
    const users = [
      user({ id: "m" }),
      user({
        id: "p",
        master_song_voted: true,
        master_song_id: "song-m",
      }),
      user({ id: "idle", my_song_id: "", master_song_voted: false }),
    ];
    expect(shouldFinalizeVotePhase(users, "m", false)).toBe(true);
  });

  it("ends voting when a player has voted even if the song id is still syncing", () => {
    const users = [
      user({ id: "m" }),
      user({
        id: "p",
        master_song_voted: true,
        master_song_id: "",
      }),
    ];
    expect(allNonMastersVoted(users, "m")).toBe(true);
    expect(shouldFinalizeVotePhase(users, "m", false)).toBe(true);
  });

  it("waits while a seated player has not voted, unless time is up", () => {
    const users = [
      user({ id: "m" }),
      user({ id: "p", master_song_voted: false }),
    ];
    expect(shouldFinalizeVotePhase(users, "m", false)).toBe(false);
    expect(shouldFinalizeVotePhase(users, "m", true)).toBe(true);
  });
});
