import { IUser } from "../api/interface";
import { isLoggedIn } from "./isLoggedIn";
import { toBool } from "./toBool";

export function nonMasterPlayers(
  users: IUser[],
  masterId: string | null | undefined,
): IUser[] {
  return users.filter(
    (u) => isLoggedIn(u) && String(u.id) !== String(masterId ?? ""),
  );
}

function hasSubmittedSong(user: IUser): boolean {
  return typeof user.my_song_id === "string" && user.my_song_id.trim().length > 0;
}

export function playersWhoMustVote(
  users: IUser[],
  masterId: string | null | undefined,
): IUser[] {
  return nonMasterPlayers(users, masterId).filter(hasSubmittedSong);
}

function hasVotedForMaster(user: IUser): boolean {
  return (
    toBool(user.master_song_voted) ||
    (typeof user.master_song_id === "string" &&
      user.master_song_id.trim().length > 0)
  );
}

export function allNonMastersVoted(
  users: IUser[],
  masterId: string | null | undefined,
): boolean {
  const others = playersWhoMustVote(users, masterId);
  return others.length > 0 && others.every(hasVotedForMaster);
}

/** End voting as soon as every seated non-Master has voted, or when the timer ends. */
export function shouldFinalizeVotePhase(
  users: IUser[],
  masterId: string | null | undefined,
  timeIsUp: boolean,
): boolean {
  return allNonMastersVoted(users, masterId) || timeIsUp;
}
