import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameState } from "../../api/interface";
import PlayersList from "./PlayersList";
import { IUser } from "../../api/interface";

const users: IUser[] = [
  {
    id: "m",
    name: "Mina",
    avatar: "music",
    game_id: "g1",
    my_song_voted: true,
    master_song_voted: false,
    points: 3,
    my_song_id: "s1",
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
    points: 1,
    my_song_id: "s2",
    master_song_id: "s1",
    is_logged: true,
  },
];

describe("PlayersList", () => {
  it("labels the Master and shows scores from both player perspectives", () => {
    render(
      <PlayersList
        usersList={users}
        masterId="m"
        gameState={GameState.USERS_VOTE}
      />,
    );

    expect(screen.getByText("Mina")).toBeInTheDocument();
    expect(screen.getByText("Master")).toBeInTheDocument();
    expect(screen.getByText("Piotr")).toBeInTheDocument();
    expect(screen.getByText("3 points")).toBeInTheDocument();
    expect(screen.getByText("1 point")).toBeInTheDocument();
  });

  it("does not list logged-out players", () => {
    render(
      <PlayersList
        usersList={[{ ...users[1], is_logged: false }]}
        masterId="m"
        gameState={GameState.MASTER_SELECTS}
      />,
    );
    expect(screen.queryByText("Piotr")).not.toBeInTheDocument();
  });
});
