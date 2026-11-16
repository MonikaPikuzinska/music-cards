import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PopUp from "./PopUp";

describe("PopUp", () => {
  it("renders instructions in a body portal above page content", async () => {
    const onClose = vi.fn();
    render(
      <div>
        <iframe title="Spotify Web Player" src="about:blank" />
        <PopUp isOpen onClose={onClose}>
          <h2>Instructions</h2>
        </PopUp>
      </div>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.parentElement).toBe(document.body);
    expect(document.body).toHaveClass("modal-open");
    expect(screen.getByText("Instructions")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close popup" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
