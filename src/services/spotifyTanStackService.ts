import { useQuery } from "@tanstack/react-query";
import {
  fetchSpotifyPlaylists,
  fetchSpotifyRandomSearch,
} from "./spotifyService";


export function useSpotifyPlaylists() {
  return useQuery({
    queryKey: ["spotify", "playlists"],
    queryFn: fetchSpotifyPlaylists,
    retry: false,
  });
}

export function useSpotifyRandomSearch() {
  return useQuery({
    queryKey: ["spotify", "randomSearch"],
    queryFn: fetchSpotifyRandomSearch,
    retry: false,
    // We only want this to load once when the page opens.
    // Disable automatic refetches so it doesn't keep refreshing tracks.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    staleTime: Infinity,
  });
}
