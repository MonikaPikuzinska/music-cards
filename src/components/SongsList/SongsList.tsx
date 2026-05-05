import React, { useEffect } from "react";
import SpotifyPlayer from "../SpotifyPlayer/SpotifyPlayer";
import { updateUser } from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { IUser } from "../../api/interface";
import { UUIDTypes } from "uuid";

interface ISpotifyTrackItem {
  id: string;
  external_urls: {
    spotify: string;
  };
}

interface SongsListProps {
  tracks: ISpotifyTrackItem[];
  isUserCreated: boolean;
  selectedTrack: string | null;
  setSelectedTrack: (id: string | null) => void;
  isSelectDisabled: boolean;
  timeIsUp?: boolean;
  startVotingForTrack?: boolean;
  masterId?: UUIDTypes | null;
  currentUser?: IUser | null;
}

const SongsList: React.FC<SongsListProps> = ({
  tracks,
  isUserCreated,
  selectedTrack,
  setSelectedTrack,
  isSelectDisabled,
  timeIsUp = false,
  startVotingForTrack = false,
  masterId = null,
  currentUser = null,
}) => {
  const { user } = useAuth();
  const [selectedSong, setSelectedSong] = React.useState<string | null>(null);
  const timeIsUpRef = React.useRef<boolean>(false);

  // Determine if we're in voting mode (timeIsUp and startVotingForTrack)
  const isVotingMode = timeIsUp && startVotingForTrack;
  // Master cannot vote
  const isMaster = currentUser?.id === masterId;
  const isVoteDisabled = isVotingMode && isMaster;

  const selectSong = () => {
    if (isVotingMode) {
      // Voting mode: save master_song_id and master_song_voted
      updateUser(user?.id?.toString() || "", {
        master_song_id: selectedSong || "",
        master_song_voted: true,
      }).catch((err) => console.error("Error updating user master_song_id:", err));
    } else {
      // Selection mode: save my_song_id and my_song_voted
      updateUser(user?.id?.toString() || "", {
        my_song_id: selectedSong || "",
        my_song_voted: true,
      }).catch((err) => console.error("Error updating user my_song_id:", err));
    }
  };

  // when global timer is up in Game, clear current selection visually (only once when timeIsUp transitions to true)
  useEffect(() => {
    if (timeIsUp && !timeIsUpRef.current) {
      // timeIsUp just transitioned from false to true
      setSelectedTrack(null);
      setSelectedSong(null);
      timeIsUpRef.current = true;
    } else if (!timeIsUp) {
      // Reset ref when timeIsUp becomes false again
      timeIsUpRef.current = false;
    }
  }, [timeIsUp, setSelectedTrack]);

  return (
    <div className="flex flex-wrap justify-center items-center max-w-9/12">
      {isUserCreated &&
        tracks.map((item) => (
          <SpotifyPlayer
            key={item.id}
            link={item.external_urls.spotify}
            isSelected={selectedTrack === item.id}
            onSelect={() => {
              setSelectedTrack(item.id);
              setSelectedSong(item.id);
            }}
          />
        ))}
      <div className="w-full text-center">
        <button
          onClick={() => selectSong()}
          className={`px-3 py-1 rounded transition-colors ${
            isSelectDisabled || isVoteDisabled
              ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-50"
              : "bg-indigo-400 text-white hover:bg-indigo-500"
          }`}
          disabled={isSelectDisabled || isVoteDisabled}
          aria-label={
            isSelectDisabled || isVoteDisabled
              ? isVotingMode
                ? "Vote for song (disabled)"
                : "Select song (disabled)"
              : isVotingMode
                ? "Vote for song"
                : "Select song"
          }
          aria-disabled={isSelectDisabled || isVoteDisabled}
        >
          {isVotingMode ? "Vote" : "Select"}
        </button>
      </div>
    </div>
  );
};

export default SongsList;
