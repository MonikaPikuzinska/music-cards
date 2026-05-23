import { toBool } from "./toBool";

/** Online unless explicitly marked logged out (false / "false"). */
export function isLoggedIn(user: { is_logged?: unknown }): boolean {
  const v = user.is_logged;
  if (v === false || v === 0) return false;
  if (typeof v === "string" && v.trim().toLowerCase() === "false") return false;
  if (v === true || v === 1) return true;
  if (typeof v === "string" && ["true", "t", "1"].includes(v.trim().toLowerCase())) {
    return true;
  }
  // null / undefined — treat as online (legacy rows without the column set)
  return v == null ? true : toBool(v);
}
