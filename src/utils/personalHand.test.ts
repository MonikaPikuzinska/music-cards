import { describe, expect, it } from "vitest";
import { shouldShowPersonalHand } from "./personalHand";

describe("shouldShowPersonalHand", () => {
  it("shows a regular user their songs while the Master is picking", () => {
    expect(
      shouldShowPersonalHand({
        isUserCreated: true,
        isMasterSelectState: true,
        isUsersSelectState: false,
        isCurrentMaster: false,
      }),
    ).toBe(true);
  });

  it("shows a regular user their songs during the select phase", () => {
    expect(
      shouldShowPersonalHand({
        isUserCreated: true,
        isMasterSelectState: false,
        isUsersSelectState: true,
        isCurrentMaster: false,
      }),
    ).toBe(true);
  });

  it("shows the Master their songs at the start of the round", () => {
    expect(
      shouldShowPersonalHand({
        isUserCreated: true,
        isMasterSelectState: true,
        isUsersSelectState: false,
        isCurrentMaster: true,
      }),
    ).toBe(true);
  });

  it("hides the Master’s personal list after they have already picked", () => {
    expect(
      shouldShowPersonalHand({
        isUserCreated: true,
        isMasterSelectState: false,
        isUsersSelectState: true,
        isCurrentMaster: true,
        masterHasPickedThisRound: true,
      }),
    ).toBe(false);
  });

  it("keeps the Master’s list if the timed phase started before they picked this round", () => {
    expect(
      shouldShowPersonalHand({
        isUserCreated: true,
        isMasterSelectState: false,
        isUsersSelectState: true,
        isCurrentMaster: true,
        masterHasPickedThisRound: false,
      }),
    ).toBe(true);
  });

  it("hides the list until the player has joined the room", () => {
    expect(
      shouldShowPersonalHand({
        isUserCreated: false,
        isMasterSelectState: true,
        isUsersSelectState: false,
        isCurrentMaster: false,
      }),
    ).toBe(false);
  });
});
