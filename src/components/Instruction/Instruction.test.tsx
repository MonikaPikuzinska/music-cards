import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Instruction from "./Instruction";

describe("Instruction", () => {
  it("renders the game rules from the instruction sheet", () => {
    render(<Instruction />);
    expect(screen.getByText(/Game Setup/i)).toBeInTheDocument();
    expect(screen.getByText(/Each player gets a different list of 6 songs/i)).toBeInTheDocument();
    expect(screen.getByText(/Clues are spoken, not typed in the app/i)).toBeInTheDocument();
    expect(screen.getByText(/Everyone sees all selected songs, including the Master’s song/i)).toBeInTheDocument();
    expect(screen.getByText(/Master’s Role/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Players cannot vote for their own submitted song/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The role of Master passes alphabetically/i),
    ).toBeInTheDocument();
  });
});
