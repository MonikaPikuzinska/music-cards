import React, { useEffect } from "react";
import SpotifyPlayer from "../SpotifyPlayer/SpotifyPlayer";
import { updateUser } from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabase-client";
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
}

const SongsList: React.FC<SongsListProps> = ({
  tracks,
  isUserCreated,
  selectedTrack,
  setSelectedTrack,
  isSelectDisabled,
  isSelectingTrackFinished = false,
}) => {
  const { user } = useAuth();
  const [selectedSong, setSelectedSong] = React.useState<string | null>(null);
  const [usersList, setUsersList] = React.useState<IUser[]>([]);

  useEffect(() => {
    // Subscribe to changes in 'users' table
    const usersSub = supabase
      .channel("users-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        (payload) => {
          // Keep local usersList in sync with DB changes
          const newRec = (payload as any)?.new as IUser | null;
          const oldRec = (payload as any)?.old as IUser | null;

          setUsersList((prev) => {
            // INSERT
            if (newRec && !oldRec) {
              if (prev.some((u) => u.id === newRec.id)) return prev;
              return [...prev, newRec];
            }
            // UPDATE
            if (newRec && oldRec) {
              return prev.map((u) => (u.id === newRec.id ? newRec : u));
            }
            // DELETE
            if (!newRec && oldRec) {
              return prev.filter((u) => u.id !== oldRec.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(usersSub);
    };
  }, [user]);

  const selectSong = () => {
    updateUser(user?.id?.toString() || "", {
      song_id: selectedSong || "",
      voted: true,
    }).catch((err) => console.error("Error updating user song_id:", err));
  };

  // when timer finishes, auto-select a song if none selected
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
      song_id: songToSubmit || "",
      voted: true,
    }).catch((err) =>
      console.error("Error updating user song_id on time up:", err)
    );
  }, [isSelectingTrackFinished]);

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
