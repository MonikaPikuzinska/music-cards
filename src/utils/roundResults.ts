import { IUser } from "../api/interface";
import { calculateRoundScores } from "./scoring";

export interface VoterInfo {
  id: string;
  name: string;
}

export interface SubmissionResult {
  userId: string;
  name: string;
  songId: string;
  isMasterSong: boolean;
  voters: VoterInfo[];
  pointsThisRound: number;
}

export function buildRoundResults(
  users: IUser[],
  masterId: string | null | undefined,
): SubmissionResult[] {
  const masterIdStr = String(masterId ?? "");
  const scores = calculateRoundScores(users, masterIdStr);
  const others = users.filter((u) => String(u.id) !== masterIdStr);

  return users
    .filter((u) => typeof u.my_song_id === "string" && u.my_song_id.trim().length > 0)
    .map((u) => {
      const songId = u.my_song_id.trim();
      const isMaster = String(u.id) === masterIdStr;
      const voters = others
        .filter(
          (voter) =>
            String(voter.id) !== String(u.id) &&
            typeof voter.master_song_id === "string" &&
            voter.master_song_id.trim() === songId,
        )
        .map((voter) => ({ id: String(voter.id), name: voter.name }));

      return {
        userId: String(u.id),
        name: u.name,
        songId,
        isMasterSong: isMaster,
        voters,
        pointsThisRound: scores[String(u.id)] ?? 0,
      };
    });
}
