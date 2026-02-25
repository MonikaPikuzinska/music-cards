import React, { useEffect } from "react";
import SpotifyPlayer from "../SpotifyPlayer/SpotifyPlayer";
import { updateUser } from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { IUser } from "../../api/interface";

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
  isSelectingTrackFinished?: boolean;
  timeIsUp?: boolean;
}

const SongsList: React.FC<SongsListProps> = ({
  tracks,
  isUserCreated,
  selectedTrack,
  setSelectedTrack,
  isSelectDisabled,
  isSelectingTrackFinished = false,
  timeIsUp = false,
}) => {
  const { user } = useAuth();
  const [selectedSong, setSelectedSong] = React.useState<string | null>(null);

  const selectSong = () => {
    updateUser(user?.id?.toString() || "", {
      my_song_id: selectedSong || "",
      my_song_voted: true,
    }).catch((err) => console.error("Error updating user my_song_id:", err));
  };

  // when selection phase finishes, auto-select a song if none selected
  React.useEffect(() => {
    if (!isSelectingTrackFinished) return;

    let songToSubmit = selectedSong;
    if (!songToSubmit && tracks && tracks.length > 0) {
      // pick a random track from available (first 6)
      const pool = tracks.slice(0, 6);
      const rand = pool[Math.floor(Math.random() * pool.length)];
      songToSubmit = rand.id;
      setSelectedSong(songToSubmit);
    }

    updateUser(user?.id?.toString() || "", {
      my_song_id: songToSubmit || "",
      my_song_voted: true,
    }).catch((err) =>
      console.error("Error updating user my_song_id on time up:", err),
    );
  }, [isSelectingTrackFinished]);

  // when global timer is up in Game, clear current selection visually
  useEffect(() => {
    if (!timeIsUp) return;
    setSelectedTrack(null);
    setSelectedSong(null);
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
            isSelectDisabled
              ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-50"
              : "bg-indigo-400 text-white hover:bg-indigo-500"
          }`}
          disabled={isSelectDisabled}
          aria-label={
            isSelectDisabled ? "Select song (disabled)" : "Select song"
          }
          aria-disabled={isSelectDisabled}
        >
          Select
        </button>
      </div>
    </div>
  );
};

export default SongsList;
