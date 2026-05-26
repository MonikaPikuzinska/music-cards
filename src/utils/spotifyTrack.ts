/** Shape expected by SongsList / SpotifyPlayer. */
export interface SpotifyListTrack {
  id: string;
  external_urls: {
    spotify: string;
  };
}

export function toSpotifyListItem(track: {
  id: string;
  external_urls?: { spotify?: string };
}): SpotifyListTrack {
  return {
    id: track.id,
    external_urls: {
      spotify:
        track.external_urls?.spotify ??
        `https://open.spotify.com/track/${track.id}`,
    },
  };
}
