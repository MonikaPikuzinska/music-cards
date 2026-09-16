import { beforeEach, describe, expect, it } from "vitest";
import { IUser } from "../api/interface";
import {
  mergeUsersLists,
  snapshotUsersForRoundReset,
} from "./usersQueryCache";

const player = (partial: Partial<IUser> & Pick<IUser, "id">): IUser =>
  ({
    name: String(partial.id),
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

describe("mergeUsersLists", () => {
  beforeEach(() => {
    snapshotUsersForRoundReset([]);
  });
  it("clears points when a player logs out", () => {
    const prev = [player({ id: "u1", points: 5, is_logged: true })];
    const fresh = [player({ id: "u1", points: 0, is_logged: false })];
    expect(mergeUsersLists(prev, fresh)[0]).toMatchObject({
      points: 0,
      is_logged: false,
    });
  });

  it("keeps zero points when that player logs back in", () => {
    const prev = [player({ id: "u1", points: 0, is_logged: false })];
    const fresh = [player({ id: "u1", points: 0, is_logged: true })];
    expect(mergeUsersLists(prev, fresh)[0].points).toBe(0);
  });

  it("drops last round's song and vote when the server sends a cleared row", () => {
    const prev = [
      player({
        id: "u1",
        points: 2,
        my_song_voted: true,
        my_song_id: "song-a",
        song_hand: ["song-a", "song-b"],
      }),
    ];
    const fresh = [
      player({
        id: "u1",
        points: 2,
        my_song_voted: false,
        my_song_id: "",
        song_hand: [],
      }),
    ];
    expect(mergeUsersLists(prev, fresh)[0]).toMatchObject({
      my_song_voted: false,
      my_song_id: "",
      song_hand: [],
    });
  });

  it("adopts this round's pick after a local next-round reset", () => {
    const prev = [
      player({
        id: "m",
        points: 2,
        my_song_voted: false,
        master_song_voted: false,
        my_song_id: "",
        master_song_id: "",
        song_hand: [],
      }),
    ];
    const thisRound = [
      player({
        id: "m",
        points: 2,
        my_song_voted: true,
        master_song_voted: false,
        my_song_id: "song-m",
        master_song_id: "",
        song_hand: ["song-m", "song-x"],
      }),
    ];
    expect(mergeUsersLists(prev, thisRound)[0]).toMatchObject({
      my_song_voted: true,
      my_song_id: "song-m",
      song_hand: ["song-m", "song-x"],
    });
  });

  it("keeps every player's submitted song so the vote board can show them", () => {
    const prev = [
      player({ id: "m", song_hand: [] }),
      player({
        id: "p",
        my_song_id: "song-p",
        my_song_voted: true,
        song_hand: ["song-p"],
      }),
    ];
    const fresh = [
      player({
        id: "m",
        my_song_id: "song-m",
        my_song_voted: true,
        song_hand: ["song-m"],
      }),
      player({
        id: "p",
        my_song_id: "song-p",
        my_song_voted: true,
        song_hand: ["song-p"],
      }),
    ];
    const merged = mergeUsersLists(prev, fresh);
    expect(merged.map((u) => u.my_song_id).sort()).toEqual(["song-m", "song-p"]);
  });

  it("keeps a new pick once this round's hand is already dealt", () => {
    const prev = [
      player({
        id: "u1",
        my_song_voted: false,
        master_song_voted: false,
        my_song_id: "",
        master_song_id: "",
        song_hand: ["new-1", "new-2"],
      }),
    ];
    const fresh = [
      player({
        id: "u1",
        my_song_voted: true,
        master_song_voted: false,
        my_song_id: "new-1",
        master_song_id: "",
        song_hand: ["new-1", "new-2"],
      }),
    ];
    expect(mergeUsersLists(prev, fresh)[0]).toMatchObject({
      my_song_voted: true,
      my_song_id: "new-1",
      song_hand: ["new-1", "new-2"],
    });
  });

  it("does not restore last round's hand after Next round", () => {
    snapshotUsersForRoundReset([
      player({
        id: "m",
        my_song_voted: true,
        my_song_id: "song-m",
        song_hand: ["song-m", "song-x", "song-y", "song-z", "song-a", "song-b"],
      }),
    ]);
    const prev = [player({ id: "m", song_hand: [] })];
    const stale = [
      player({
        id: "m",
        my_song_voted: true,
        my_song_id: "song-m",
        song_hand: ["song-m", "song-x", "song-y", "song-z", "song-a", "song-b"],
      }),
    ];
    expect(mergeUsersLists(prev, stale)[0]).toMatchObject({
      my_song_voted: false,
      my_song_id: "",
      song_hand: [],
    });
    const thisRound = [
      player({
        id: "m",
        my_song_voted: true,
        my_song_id: "new-m",
        song_hand: ["new-m", "new-2", "new-3", "new-4", "new-5", "new-6"],
      }),
    ];
    expect(mergeUsersLists(prev, thisRound)[0]).toMatchObject({
      my_song_voted: true,
      my_song_id: "new-m",
    });
  });

  it("clears last round my_song_id and master_song_id after Next round", () => {
    snapshotUsersForRoundReset([
      player({
        id: "p",
        my_song_id: "old-my",
        master_song_id: "old-master",
        song_hand: ["old-my", "h2", "h3", "h4", "h5", "h6"],
      }),
    ]);
    const prev = [
      player({
        id: "p",
        my_song_id: "old-my",
        master_song_id: "old-master",
        song_hand: ["new-1", "new-2", "new-3", "new-4", "new-5", "new-6"],
      }),
    ];
    const fresh = [
      player({
        id: "p",
        my_song_id: "",
        master_song_id: "",
        song_hand: ["new-1", "new-2", "new-3", "new-4", "new-5", "new-6"],
      }),
    ];
    expect(mergeUsersLists(prev, fresh)[0]).toMatchObject({
      my_song_id: "",
      master_song_id: "",
      my_song_voted: false,
      master_song_voted: false,
    });
  });
});
