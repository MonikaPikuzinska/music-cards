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

// Check whether the spotify provider token exists and is not expired
export const isSpotifySessionValid = async (): Promise<boolean> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return false;
  const session: any = data.session;
  const providerToken = session.provider_token;
  const expiresAt = session.expires_at; // seconds since epoch
  if (!providerToken) return false;
  if (typeof expiresAt === "number") {
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt <= now) return false;
  }
  return true;
};

// Generic Spotify API request helper
const spotifyApiRequest = async <T = any>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    params?: any;
    data?: any;
  } = {},
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
      limit: 12,
    },
  });
};

// Fetch a single Spotify track by id
export const getSpotifyTrack = async (trackId: string) => {
  return spotifyApiRequest(`/tracks/${encodeURIComponent(trackId)}`);
};
