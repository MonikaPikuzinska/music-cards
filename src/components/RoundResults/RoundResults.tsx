import React from "react";
import { IUser } from "../../api/interface";
import { UUIDTypes } from "uuid";
import { buildRoundResults } from "../../utils/roundResults";
import { getNextMaster } from "../../utils/nextMaster";
import SpotifyPlayer from "../SpotifyPlayer/SpotifyPlayer";
import Button from "../Button/Button";

interface RoundResultsProps {
  usersList: IUser[];
  masterId: UUIDTypes | null;
  tracksById: Record<string, { id: string; external_urls: { spotify: string } }>;
  onNextRound: () => void;
  nextRoundLoading?: boolean;
}

const RoundResults: React.FC<RoundResultsProps> = ({
  usersList,
  masterId,
  tracksById,
  onNextRound,
  nextRoundLoading = false,
}) => {
  const masterIdStr = masterId != null ? String(masterId) : null;
  const results = buildRoundResults(usersList, masterIdStr);
  const nextMaster = getNextMaster(usersList, masterIdStr);

  return (
    <div className="w-full max-w-4xl">
      <h2 className="text-2xl font-bold text-indigo-500 mb-2">Round results</h2>
      <ul className="space-y-4">
        {results.map((row) => {
          const track = tracksById[row.songId];
          return (
            <li
              key={row.userId}
              className="rounded-xl bg-white p-4 shadow-sm border border-indigo-100"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-bold text-indigo-700">{row.name}</span>
                {row.isMasterSong ? (
                  <span className="text-xs font-semibold uppercase bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded">
                    Master&apos;s song
                  </span>
                ) : null}
                <span className="text-sm text-indigo-500">
                  +{row.pointsThisRound} this round
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                {row.voters.length > 0
                  ? `Votes: ${row.voters.map((v) => v.name).join(", ")}`
                  : "No votes"}
              </p>
              {track ? (
                <SpotifyPlayer
                  link={track.external_urls.spotify}
                  isSelected={row.isMasterSong}
                  disabled
                  onSelect={() => undefined}
                  height={80}
                  wide
                />
              ) : (
                <p className="text-sm text-gray-400">Song unavailable</p>
              )}
            </li>
          );
        })}
      </ul>
      {nextMaster ? (
        <p className="mt-4 text-sm text-indigo-500">
          Next Master: <span className="font-semibold">{nextMaster.name}</span>
        </p>
      ) : null}
      <Button
        label={nextRoundLoading ? "Starting…" : "Next round"}
        onClick={onNextRound}
        disabled={nextRoundLoading}
      />
    </div>
  );
};

export default RoundResults;
