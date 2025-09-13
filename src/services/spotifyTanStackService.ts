import { useQuery } from "@tanstack/react-query";
import { fetchSpotifyPlaylists, fetchSpotifyRandomSearch } from "./spotifyService";


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
  });
}
