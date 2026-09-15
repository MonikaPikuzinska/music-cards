import { describe, expect, it } from "vitest";
import { isValidGameLink, parseGameIdFromLink } from "./isValidGameLink";

describe("isValidGameLink", () => {
  it("accepts relative and absolute game URLs", () => {
    expect(isValidGameLink("/game/abc-123")).toBe(true);
    expect(isValidGameLink("game/abc-123")).toBe(true);
    expect(isValidGameLink("https://example.com/game/abc-123")).toBe(true);
  });

  it("rejects junk", () => {
    expect(isValidGameLink("https://example.com/other/abc")).toBe(false);
    expect(isValidGameLink("not a link")).toBe(false);
    expect(isValidGameLink("")).toBe(false);
  });
});

describe("parseGameIdFromLink", () => {
  it("extracts the game id", () => {
    expect(parseGameIdFromLink("https://host/game/room-9")).toBe("room-9");
    expect(parseGameIdFromLink("/game/room-9")).toBe("room-9");
  });
});
