import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn() }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: "" }),
}));

import Login from "./Login";

describe("Login", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it("asks a visitor to log in with Spotify", () => {
    useAuthMock.mockReturnValue({
      user: null,
      signInWithSpotify: vi.fn(),
    });
    render(<Login />);
    expect(screen.getByText("Imagine the music")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Log in with Spotify" }),
    ).toBeInTheDocument();
  });

  it("lets a logged-in player create a game or join with a link", () => {
    useAuthMock.mockReturnValue({
      user: { id: "u1", user_metadata: { name: "Ada" } },
      signInWithSpotify: vi.fn(),
    });
    render(<Login />);
    expect(
      screen.getByRole("button", { name: "Create a game" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enter the game" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Provide link to the game/i)).toBeInTheDocument();
  });
});
