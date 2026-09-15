import { describe, expect, it } from "vitest";
import { toBool } from "./toBool";
import { isLoggedIn } from "./isLoggedIn";

describe("toBool", () => {
  it("parses postgres-style booleans", () => {
    expect(toBool(true)).toBe(true);
    expect(toBool("true")).toBe(true);
    expect(toBool("t")).toBe(true);
    expect(toBool("false")).toBe(false);
    expect(toBool("f")).toBe(false);
    expect(toBool(null)).toBe(false);
  });
});

describe("isLoggedIn", () => {
  it("treats explicit false as offline and null as online", () => {
    expect(isLoggedIn({ is_logged: false })).toBe(false);
    expect(isLoggedIn({ is_logged: "false" })).toBe(false);
    expect(isLoggedIn({ is_logged: true })).toBe(true);
    expect(isLoggedIn({ is_logged: null })).toBe(true);
    expect(isLoggedIn({})).toBe(true);
  });
});
