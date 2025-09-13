import React from "react";
import {
  useSpotifyPlaylists,
  useSpotifyRandomSearch,
} from "../../services/spotifyTanStackService";

const Game = () => {
  const { data, error, isLoading } = useSpotifyPlaylists();
  console.log(data);
  const { data: randomSearchData } = useSpotifyRandomSearch();
  console.log("randomSearchData", randomSearchData);
  return (
    <div>
      <h1>Imagine the music</h1>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error fetching playlists</p>}
      {data && (
        <ul>
          {data.items.map((playlist: { id: string; name: string }) => (
            <li key={playlist.id}>{playlist.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Game;
