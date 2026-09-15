import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IUser } from "../../api/interface";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "player-1" } }),
}));

vi.mock("../../api/api", () => ({
  updateUser: vi.fn().mockResolvedValue([]),
}));

vi.mock("../SpotifyPlayer/SpotifyPlayer", () => ({
  default: ({
    badge,
    disabled,
    onSelect,
  }: {
    badge?: string;
    disabled?: boolean;
    onSelect: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onSelect}>
      {badge ?? "track"}
    </button>
  ),
}));

import SongsList from "./SongsList";

const track = (id: string) => ({
  id,
  external_urls: { spotify: `https://open.spotify.com/track/${id}` },
});

const player: IUser = {
  id: "player-1",
  name: "Piotr",
  avatar: "guitar",
  game_id: "g1",
  my_song_voted: true,
  master_song_voted: false,
  points: 0,
  my_song_id: "song-mine",
  master_song_id: "",
  is_logged: true,
  song_hand: ["song-mine", "song-b"],
};

describe("SongsList perspectives", () => {
  it("lets the Master select a song without typing a clue", () => {
    const master: IUser = { ...player, id: "master-1", my_song_id: "" };
    render(
      <SongsList
        tracks={[track("song-a")]}
        isUserCreated
        selectedTrack={null}
        setSelectedTrack={() => undefined}
        isSelectDisabled={false}
        masterId="master-1"
        currentUser={master}
        confirmLabel="Select"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Select song (disabled)" }),
    ).toBeDisabled();
    expect(
      screen.queryByText(/clue/i),
    ).not.toBeInTheDocument();
  });

  it("stops a regular player from voting for their own song among everyone’s submissions", () => {
    render(
      <SongsList
        tracks={[track("song-mine"), track("song-master")]}
        isUserCreated
        selectedTrack={null}
        setSelectedTrack={() => undefined}
        isSelectDisabled={false}
        isVotePhase
        masterId="master-1"
        currentUser={player}
        confirmLabel="Vote"
      />,
    );
    expect(screen.getByText("Your song")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Your song" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "track" })).toBeEnabled();
  });

  it("keeps existing songs visible while a later fetch is in progress", () => {
    render(
      <SongsList
        tracks={[track("song-a")]}
        isUserCreated
        selectedTrack={null}
        setSelectedTrack={() => undefined}
        isSelectDisabled={false}
        tracksLoading
        masterId="master-1"
        currentUser={player}
        confirmLabel="Select"
      />,
    );
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "track" })).toBeInTheDocument();
  });
});
