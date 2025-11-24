import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "../../utils/getRandomAvatar";
import { IUser } from "../../api/interface";
import { UUIDTypes } from "uuid";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

interface PlayersListProps {
  usersList: IUser[];
  masterId: UUIDTypes | null;
}

const PlayersList: React.FC<PlayersListProps> = ({ usersList, masterId }) => (
  <div className="p-4 mt-4 w-full">
    <h2 className="text-lg font-bold text-indigo-400 mb-2">Players:</h2>
    <ul>
      {usersList.map((u) => (
        <li key={u.name}>
          <FontAwesomeIcon
            icon={icons[u.avatar as keyof typeof icons]}
            className="text-indigo-400"
          />
          <span
            className={`ml-2 mr-2 font-bold ${
              masterId === u.id ? "text-indigo-600" : ""
            }`}
          >
            {u.name}
          </span>
          <span className="mr-2">{`${u.points} ${
            u.points === 1 ? "point" : "points"
          }`}</span>
          {u.voted ? (
            <FontAwesomeIcon className="text-indigo-400" icon={faCheck} />
          ) : null}
        </li>
      ))}
    </ul>
  </div>
);

export default PlayersList;
