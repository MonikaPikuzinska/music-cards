import { IUser } from "../api/interface";
import { isLoggedIn } from "./isLoggedIn";

export const byNameThenId = (a: { name: string; id: unknown }, b: { name: string; id: unknown }) => {
  const names = a.name.localeCompare(b.name, undefined, {
    sensitivity: "base",
  });
  if (names !== 0) return names;
  return String(a.id).localeCompare(String(b.id));
};

/** Next Master is the next player in alphabetical name order (wraps). */
export function getNextMaster(
  users: IUser[],
  currentMasterId: string | null | undefined,
): IUser | null {
  const all = [...users].sort(byNameThenId);
  const seated = all.filter(isLoggedIn);
  // Need 2+ seated players to skip logged-out; otherwise still rotate in a pair.
  const pool = seated.length >= 2 ? seated : all;
  if (pool.length === 0) return null;

  const currentIdx = pool.findIndex(
    (u) => String(u.id) === String(currentMasterId ?? ""),
  );
  if (currentIdx < 0) return pool[0];
  return pool[(currentIdx + 1) % pool.length];
}
