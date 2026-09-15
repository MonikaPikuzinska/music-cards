import { IUser } from "../api/interface";
import { isLoggedIn } from "./isLoggedIn";

const byNameThenId = (a: IUser, b: IUser) => {
  const names = a.name.localeCompare(b.name, undefined, {
    sensitivity: "base",
  });
  if (names !== 0) return names;
  return String(a.id).localeCompare(String(b.id));
};

/** Next Master is the next logged-in player in alphabetical name order (wraps). */
export function getNextMaster(
  users: IUser[],
  currentMasterId: string | null | undefined,
): IUser | null {
  const seated = users.filter(isLoggedIn).sort(byNameThenId);
  if (seated.length === 0) return null;

  const currentIdx = seated.findIndex(
    (u) => String(u.id) === String(currentMasterId ?? ""),
  );
  if (currentIdx < 0) return seated[0];
  return seated[(currentIdx + 1) % seated.length];
}
