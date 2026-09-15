import React, { useEffect } from "react";
import SpotifyPlayer from "../SpotifyPlayer/SpotifyPlayer";
import { updateUser } from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { IUser } from "../../api/interface";
import { UUIDTypes } from "uuid";
import { canVoteForTrack } from "../../utils/canVoteForTrack";

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
  isVotePhase?: boolean;
  tracksLoading?: boolean;
  masterId?: UUIDTypes | null;
  currentUser?: IUser | null;
  onUserSaved?: (userId: string, patch: Partial<IUser>) => void;
  hideConfirm?: boolean;
  confirmLabel?: string;
}

const SongsList: React.FC<SongsListProps> = ({
  tracks,
  isUserCreated,
  selectedTrack,
  setSelectedTrack,
  isSelectDisabled,
  timeIsUp = false,
  isVotePhase = false,
  tracksLoading = false,
  masterId = null,
  currentUser = null,
  onUserSaved,
  hideConfirm = false,
  confirmLabel,
}) => {
  const { user } = useAuth();
  const [selectedSong, setSelectedSong] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const timeIsUpRef = React.useRef<boolean>(false);

  const isVotingMode = isVotePhase;
  const isMaster =
    currentUser?.id != null &&
    masterId != null &&
    String(currentUser.id) === String(masterId);
  const isVoteDisabled = isVotingMode && isMaster;
  const ownSongId = currentUser?.my_song_id;
  const cannotConfirmOwnSong =
    isVotingMode && !canVoteForTrack(selectedSong, ownSongId);
  const buttonDisabled =
    isSelectDisabled ||
    isVoteDisabled ||
    cannotConfirmOwnSong ||
    !selectedSong ||
    isSaving;

  const selectSong = async () => {
    const dbUserId = currentUser?.id?.toString() || user?.id?.toString() || "";
    if (!dbUserId || !selectedSong || buttonDisabled) return;
    if (isVotingMode && !canVoteForTrack(selectedSong, ownSongId)) return;

    setIsSaving(true);
    try {
      const patch: Partial<IUser> = isVotingMode
        ? { master_song_id: selectedSong, master_song_voted: true }
        : { my_song_id: selectedSong, my_song_voted: true };

      const rows = await updateUser(dbUserId, patch);
      const saved = rows?.[0] as Partial<IUser> | undefined;
      onUserSaved?.(dbUserId, saved ? { ...patch, ...saved } : patch);
    } catch (err) {
      console.error(
        isVotingMode
          ? "Error updating user master_song_id:"
          : "Error updating user my_song_id:",
        err,
      );
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (timeIsUp && !timeIsUpRef.current) {
      setSelectedTrack(null);
      setSelectedSong(null);
      timeIsUpRef.current = true;
    } else if (!timeIsUp) {
      timeIsUpRef.current = false;
    }
  }, [timeIsUp, setSelectedTrack]);

  return (
    <div className="flex flex-wrap justify-center items-center max-w-9/12">
      {tracksLoading ? (
        <p className="w-full text-center text-indigo-500 text-sm py-4">
          {isVotePhase
            ? "Loading everyone’s songs…"
            : "Loading your songs…"}
        </p>
      ) : null}
      {isUserCreated &&
        tracks.map((item) => {
          const isOwnSong =
            isVotingMode && !canVoteForTrack(item.id, ownSongId);
          return (
            <SpotifyPlayer
              key={item.id}
              link={item.external_urls.spotify}
              isSelected={selectedTrack === item.id}
              disabled={
                isOwnSong || isVoteDisabled || isSelectDisabled || hideConfirm
              }
              badge={isOwnSong ? "Your song" : undefined}
              onSelect={() => {
                if (isOwnSong || hideConfirm) return;
                setSelectedTrack(item.id);
                setSelectedSong(item.id);
              }}
            />
          );
        })}
      {hideConfirm ? null : (
        <div className="w-full text-center">
          <button
            onClick={() => void selectSong()}
            className={`px-3 py-1 rounded transition-colors ${
              buttonDisabled
                ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-50"
                : "bg-indigo-400 text-white hover:bg-indigo-500"
            }`}
            disabled={buttonDisabled}
            aria-label={
              buttonDisabled
                ? isVotingMode
                  ? "Vote for song (disabled)"
                  : "Select song (disabled)"
                : isVotingMode
                  ? "Vote for song"
                  : "Select song"
            }
            aria-disabled={buttonDisabled}
          >
            {confirmLabel
              ? confirmLabel
              : isVotingMode
                ? "Vote"
                : "Select"}
          </button>
          {isVotingMode && cannotConfirmOwnSong && selectedSong ? (
            <p className="text-sm text-indigo-500 mt-2">
              You cannot vote for your own song.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default SongsList;
