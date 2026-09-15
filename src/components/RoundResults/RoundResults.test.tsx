import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RoundResults from "./RoundResults";
import { IUser } from "../../api/interface";

vi.mock("../SpotifyPlayer/SpotifyPlayer", () => ({
  default: ({ badge }: { badge?: string }) => (
    <div>{badge ?? "player"}</div>
  ),
}));

const users: IUser[] = [
  {
    id: "m",
    name: "Mina",
    avatar: "music",
    game_id: "g1",
    my_song_voted: true,
    master_song_voted: false,
    points: 3,
    my_song_id: "song-m",
    master_song_id: "",
    is_logged: true,
  },
  {
    id: "p",
    name: "Piotr",
    avatar: "guitar",
    game_id: "g1",
    my_song_voted: true,
    master_song_voted: true,
    points: 3,
    my_song_id: "song-p",
    master_song_id: "song-m",
    is_logged: true,
  },
];

describe("RoundResults", () => {
  it("shows who submitted the Master song, votes, and the next Master", () => {
    render(
      <RoundResults
        usersList={users}
        masterId="m"
        tracksById={{
          "song-m": {
            id: "song-m",
            external_urls: { spotify: "https://open.spotify.com/track/song-m" },
          },
          "song-p": {
            id: "song-p",
            external_urls: { spotify: "https://open.spotify.com/track/song-p" },
          },
        }}
        onNextRound={() => undefined}
      />,
    );

    expect(screen.getByText("Round results")).toBeInTheDocument();
    expect(screen.queryByText("midnight rain")).not.toBeInTheDocument();
    expect(screen.getByText("Master's song")).toBeInTheDocument();
    expect(screen.getByText(/Next Master:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next round" })).toBeEnabled();
  });
});
