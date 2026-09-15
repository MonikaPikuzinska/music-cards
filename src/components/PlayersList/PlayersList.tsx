import React, { memo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "../../utils/getRandomAvatar";
import { GameState, IUser } from "../../api/interface";
import { UUIDTypes } from "uuid";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { toBool } from "../../utils/toBool";
import { isLoggedIn } from "../../utils/isLoggedIn";

interface PlayersListProps {
  usersList: IUser[];
  masterId: UUIDTypes | null;
  gameState?: GameState;
}

export function shouldShowVotedCheck(
  u: IUser,
  gameState: GameState | undefined,
  masterId: UUIDTypes | null,
): boolean {
  const isMaster =
    masterId != null && String(u.id) === String(masterId);

  if (gameState === GameState.USERS_VOTE || gameState === GameState.FINAL) {
    if (isMaster) return false;
    return toBool(u.master_song_voted);
  }

  if (
    gameState === GameState.USERS_SELECT ||
    gameState === GameState.MASTER_SELECTS
  ) {
    return toBool(u.my_song_voted);
  }

  return false;
}

const PlayersList: React.FC<PlayersListProps> = ({
  usersList,
  masterId,
  gameState,
}) => (
  <div className="p-4 mt-4 w-full">
    <h2 className="text-lg font-bold text-indigo-400 mb-2">Players:</h2>
    <ul>
      {usersList
        .filter((u) => isLoggedIn(u))
        .map((u) => {
          const showCheck = shouldShowVotedCheck(u, gameState, masterId);
          const isMaster = String(masterId) === String(u.id);
          return (
            <li key={String(u.id)} className="mb-1">
              <FontAwesomeIcon
                icon={icons[u.avatar as keyof typeof icons]}
                className="text-indigo-400"
              />
              <span
                className={`ml-2 mr-2 font-bold ${
                  isMaster ? "text-indigo-600" : ""
                }`}
              >
                {u.name}
              </span>
              {isMaster ? (
                <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-indigo-500">
                  Master
                </span>
              ) : null}
              <span className="mr-2">{`${u.points} ${
                u.points === 1 ? "point" : "points"
              }`}</span>
              {showCheck ? (
                <FontAwesomeIcon className="text-indigo-400" icon={faCheck} />
              ) : null}
            </li>
          );
        })}
    </ul>
  </div>
);

export default memo(PlayersList);
