import axios from "axios";
import { supabase } from "../supabase-client";
import { getRandomSearch } from "../utils/getRandomSearch";

let onSpotifyUnauthorized: (() => void) | null = null;

export const setOnSpotifyUnauthorized = (cb: (() => void) | null) => {
  onSpotifyUnauthorized = cb;
};

const spotifyAxios = axios.create({ baseURL: "https://api.spotify.com/v1" });

spotifyAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 && typeof onSpotifyUnauthorized === "function") {
      try {
        onSpotifyUnauthorized();
      } catch (err) {
        console.error("Error in onSpotifyUnauthorized handler:", err);
      }
    }
    return Promise.reject(error);
  },
);

// Helper to get the Spotify access token from Supabase cookie
const getSpotifyAccessToken = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;
  return data.session.provider_token || null;
};

// Check whether the spotify provider token exists and is not expired
export const isSpotifySessionValid = async (): Promise<boolean> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return false;
  const session: any = data.session;
  const providerToken = session.provider_token;
  const expiresAt = session.expires_at;
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
  const response = await spotifyAxios.request({
    url: endpoint,
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

export const fetchSpotifyRandomSearch = async (limit = 50) => {
  return spotifyApiRequest("/search", {
    params: {
      q: getRandomSearch(),
      offset: Math.floor(Math.random() * 1000),
      type: "track",
      limit,
    },
  });
};

// Fetch a single Spotify track by id
export const getSpotifyTrack = async (trackId: string) => {
  return spotifyApiRequest(`/tracks/${encodeURIComponent(trackId)}`);
};

export const getSpotifyTracksByIds = async (trackIds: string[]) => {
  const ids = [...new Set(trackIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return [];

  const data = await spotifyApiRequest<{
    tracks: Array<{
      id: string;
      external_urls?: { spotify?: string };
    } | null>;
  }>("/tracks", {
    params: { ids: ids.slice(0, 50).join(",") },
  });

  return (data.tracks ?? []).filter(
    (track): track is NonNullable<typeof track> => track != null && !!track.id,
  );
};

export async function fetchUnusedSpotifyTracks(
  excludeIds: Set<string>,
  needed: number,
): Promise<Array<{ id: string; external_urls?: { spotify?: string } }>> {
  const found: Array<{ id: string; external_urls?: { spotify?: string } }> = [];
  const seen = new Set(excludeIds);
  let attempts = 0;

  while (found.length < needed && attempts < 8) {
    attempts += 1;
    const data = await fetchSpotifyRandomSearch(50);
    const items = data?.tracks?.items ?? [];
    for (const item of items) {
      const id = String(item?.id ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      found.push(item);
      if (found.length >= needed) break;
    }
  }

  return found;
}
