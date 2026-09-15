import { describe, expect, it } from "vitest";
import { sameTrackList, toSpotifyListItem } from "./spotifyTrack";

describe("sameTrackList", () => {
  it("is true when ids match in order", () => {
    expect(
      sameTrackList([{ id: "a" }, { id: "b" }], [{ id: "a" }, { id: "b" }]),
    ).toBe(true);
  });

  it("is false when length or ids change", () => {
    expect(sameTrackList([{ id: "a" }], [{ id: "a" }, { id: "b" }])).toBe(
      false,
    );
    expect(sameTrackList([{ id: "a" }], [{ id: "b" }])).toBe(false);
  });
});

describe("toSpotifyListItem", () => {
  it("fills a spotify url when the API omits one", () => {
    expect(toSpotifyListItem({ id: "abc" })).toEqual({
      id: "abc",
      external_urls: { spotify: "https://open.spotify.com/track/abc" },
    });
  });
});
