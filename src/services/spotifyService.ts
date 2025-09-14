import axios from "axios";
import { supabase } from "../supabase-client";
import { getRandomSearch } from "../utils/getRandomSearch";

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
  return spotifyApiRequest("/search", {
    params: {
      q: getRandomSearch(),
      offset: Math.floor(Math.random() * 1000),
      type: "track",
      limit: 10,
    },
  });
};
