import { describe, expect, it } from "vitest";
import { calcTimeLeft, formatMMSS } from "./timerMath";

describe("timerMath", () => {
  it("formats seconds as mm:ss", () => {
    expect(formatMMSS(0)).toBe("00:00");
    expect(formatMMSS(5)).toBe("00:05");
    expect(formatMMSS(120)).toBe("02:00");
    expect(formatMMSS(75)).toBe("01:15");
  });

  it("counts down from a shared server timestamp", () => {
    const startedAt = "2026-09-15T08:00:00.000Z";
    const start = Date.parse(startedAt);
    expect(calcTimeLeft(120, startedAt, start)).toBe(120);
    expect(calcTimeLeft(120, startedAt, start + 30_000)).toBe(90);
    expect(calcTimeLeft(120, startedAt, start + 120_000)).toBe(0);
    expect(calcTimeLeft(120, startedAt, start + 200_000)).toBe(0);
  });
});
