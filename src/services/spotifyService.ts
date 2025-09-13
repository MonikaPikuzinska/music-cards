import axios from "axios";
import { supabase } from "../supabase-client";

// Helper to get the Spotify access token from Supabase cookie
const getSpotifyAccessToken = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;
  // Assuming the access token is stored in the session's provider_token
  return data.session.provider_token || null;
};

// Generic Spotify API request helper
const spotifyApiRequest = async <T = any>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    params?: any;
    data?: any;
  } = {}
): Promise<T> => {
  const accessToken = await getSpotifyAccessToken();

  if (!accessToken) throw new Error("No Spotify access token found");
  const { method = "GET", params, data } = options;
  const response = await axios({
    url: `https://api.spotify.com/v1${endpoint}`,
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    params,
    data,
  });
  return response.data;
};

export const fetchSpotifyPlaylists = async () => {
  return spotifyApiRequest("/me/playlists");
};

export const fetchSpotifyRandomSearch = async () => {
  return spotifyApiRequest("/me/search", {
    params: {
      q: "remaster%2520track%3ADoxy%2520artist%3AMiles%2520Davis",
      type: "track",
      limit: 10,
    },
  });
};
