import React from "react";
import SpotifyPlayer from "../SpotifyPlayer/SpotifyPlayer";

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
  usersCount: number;
}

const SongsList: React.FC<SongsListProps> = ({
  tracks,
  isUserCreated,
  selectedTrack,
  setSelectedTrack,
  usersCount,
}) => (
  <div className="flex flex-wrap justify-center items-center max-w-9/12">
    {isUserCreated &&
      tracks
        .slice(0, 6)
        .map((item) => (
          <SpotifyPlayer
            key={item.id}
            link={item.external_urls.spotify}
            isSelected={selectedTrack === item.id}
            onSelect={() => setSelectedTrack(item.id)}
          />
        ))}
    <div className="w-full text-center">
      <button
        onClick={() => setSelectedTrack(null)}
        className={`px-3 py-1 rounded transition-colors ${
          usersCount < 4 || !selectedTrack
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-indigo-400 text-white hover:bg-indigo-500"
        }`}
        disabled={usersCount < 4 || !selectedTrack}
      >
        Select
      </button>
    </div>
  </div>
);

export default SongsList;
