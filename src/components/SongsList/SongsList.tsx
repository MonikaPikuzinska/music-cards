import React from "react";
import SpotifyPlayer from "../SpotifyPlayer/SpotifyPlayer";
import { updateUser } from "../../api/api";
import { useAuth } from "../../context/AuthContext";

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
}

const SongsList: React.FC<SongsListProps> = ({
  tracks,
  isUserCreated,
  selectedTrack,
  setSelectedTrack,
  isSelectDisabled,
}) => {
  const { user } = useAuth();
  const [selectedSong, setSelectedSong] = React.useState<string | null>(null);

  const selectSong = () => {
    updateUser(user?.id?.toString() || "", {
      song_id: selectedSong || "",
      voted: true,
    }).catch((err) => console.error("Error updating user song_id:", err));
  };

  return (
    <div className="flex flex-wrap justify-center items-center max-w-9/12">
      {isUserCreated &&
        tracks.slice(0, 6).map((item) => (
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
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-indigo-400 text-white hover:bg-indigo-500"
          }`}
          disabled={isSelectDisabled}
        >
          Select
        </button>
      </div>
    </div>
  );
};

export default SongsList;
