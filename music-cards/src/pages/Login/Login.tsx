import { useNavigate } from "react-router-dom";
import { v4 as uuid, UUIDTypes } from "uuid";
import { useMutation } from "@tanstack/react-query";
import { createGameBoardDB } from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { IUser } from "../../api/interface";
import { useEffect, useState } from "react";
import Button from "../../components/Button/Button";

const Login = () => {
  const [sessionId, setSessionId] = useState<UUIDTypes>();
  const [gameId, setGameId] = useState<UUIDTypes>();
  const [userId, setUserId] = useState<UUIDTypes>();
  const [gameLink, setGameLink] = useState<string>("");

  const { signInWithSpotify, user } = useAuth();

  const navigate = useNavigate();

  const { mutate } = useMutation({
    mutationFn: async (data: { userData: IUser }) => {
      await createGameBoardDB(data.userData).then(() =>
        navigate(`/game/${data.userData.session_id}`)
      );
    },
  });

  useEffect(() => {
    if (user) {
      setSessionId(uuid());
      setGameId(uuid());
      setUserId(uuid());
    }
  }, [user]);

  const createGameBoard = () => {
    if (user && sessionId && gameId && userId)
      mutate({
        userData: {
          id: userId,
          session_id: sessionId,
          game_id: gameId,
          name: user ? user.user_metadata?.name : uuid(),
          avatar: user ? user.user_metadata?.avatar_url : "",
          voted: false,
          points: 0,
          song_id: "",
          is_logged: true,
        },
      });
  };

  console.log(user);

  return (
    <div className="flex  justify-center items-center flex-col h-100">
      <h1 className="text-indigo-400 text-2xl font-bold">Imagine the music </h1>
      <div className="w-100 h-80 mt-5 p-5 shadow-lg">
        {!user ? (
          <div className="flex h-full justify-center items-center flex-col">
            {" "}
            <Button
              onClick={signInWithSpotify}
              label="Log in with Spotify"
            />
          </div>
        ) : (
          <div className="flex h-full justify-center items-center flex-col">
            <Button
              onClick={createGameBoard}
              label="Create a game"
            />
            <h1 className="text-indigo-400 text-l mt-3 mb-3">or </h1>
            <div>
              <label
                htmlFor="link"
                className="text-center text-indigo-400 block mb-2 font-medium"
              >
                Provide link to the game
              </label>
              <input
                type="text"
                id="link"
                value={gameLink}
                onChange={(e) => setGameLink(e.target.value)}
                className="w-80 border-2 focus:outline-none focus:ring-0 focus:border-indigo-300/50 border-indigo-300/50 bg-transparent p-0.5 rounded"
              />
            </div>
            <Button
              onClick={() => navigate(gameLink)}
              label="Enter the game"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
