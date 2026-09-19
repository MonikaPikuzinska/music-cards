import { useNavigate, useLocation } from "react-router-dom";
import { v4 as uuid, UUIDTypes } from "uuid";
import { useMutation } from "@tanstack/react-query";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { createGameBoardDB } from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { IUser } from "../../api/interface";
import { useEffect, useState } from "react";
import Button from "../../components/Button/Button";
import getRandomAvatar from "../../utils/getRandomAvatar";
import {
  isValidGameLink,
  parseGameIdFromLink,
} from "../../utils/isValidGameLink";

const ACCESS_EMAIL = "monika.pikuzinska01@gmail.com";
const ACCESS_MAILTO =
  "mailto:monika.pikuzinska01@gmail.com?subject=Music%20Cards%20access&body=Spotify%20username%3A%0AEmail%20connected%20to%20this%20Spotify%20account%3A%0A";

const Login = () => {
  const [gameId, setGameId] = useState<UUIDTypes>();
  const [userId, setUserId] = useState<UUIDTypes>();
  const [gameLink, setGameLink] = useState<string>("");
  const [isInvalidLink, setIsInvalidLink] = useState<boolean>(false);

  const { signInWithSpotify, user } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo") || undefined;

  const { mutate } = useMutation({
    mutationFn: async (data: { userData: IUser }) => {
      await createGameBoardDB(data.userData).then(() =>
        navigate(`/game/${data.userData.game_id}`),
      );
    },
  });

  useEffect(() => {
    if (user) {
      setGameId(uuid());
      setUserId(uuid());
    }
  }, [user]);

  useEffect(() => {
    // If user is already logged and returnTo provided, redirect back
    if (user && returnTo) {
      // ensure returnTo is an absolute path
      navigate(returnTo);
    }
  }, [user, returnTo, navigate]);

  const createGameBoard = () => {
    const randomAvatar = getRandomAvatar();
    if (user && gameId && userId)
      mutate({
        userData: {
          id: user.id,
          game_id: gameId,
          name: user ? user.user_metadata?.name : uuid(),
          avatar: user ? randomAvatar.iconName : "",
          my_song_voted: false,
          master_song_voted: false,
          points: 0,
          my_song_id: "",
          master_song_id: "",
          is_logged: true,
          song_hand: [],
        },
      });
  };

  return (
    <div className="flex  justify-center items-center flex-col h-100">
      <h1 className="text-indigo-400 text-2xl font-bold">Imagine the music </h1>
      <div className="w-100 min-h-80 mt-5 p-5">
        {!user ? (
          <div className="flex h-full justify-center items-center flex-col">
            {" "}
            <Button
              onClick={() =>
                signInWithSpotify(
                  returnTo ? window.location.origin + returnTo : undefined,
                )
              }
              label="Log in with Spotify"
            />
            <aside className="mt-8 w-full max-w-sm rounded-2xl border border-indigo-200 bg-white px-5 py-4 text-left shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-indigo-500">
                <FontAwesomeIcon icon={faEnvelope} />
                Access required
              </p>
              <p className="mt-2 text-sm leading-5 text-gray-600">
                Email this address with the details below. You can log in after
                you are added.
              </p>
              <a
                className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-100"
                href={ACCESS_MAILTO}
              >
                <FontAwesomeIcon icon={faEnvelope} />
                {ACCESS_EMAIL}
              </a>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600">
                <li>your Spotify username</li>
                <li>the email connected to that Spotify account</li>
              </ul>
            </aside>
          </div>
        ) : (
          <div className="flex h-full justify-center items-center flex-col">
            <Button onClick={createGameBoard} label="Create a game" />
            <h1 className="text-indigo-400 text-l mt-3 mb-3">or </h1>
            <div>
              <label
                htmlFor="link"
                className="text-center text-indigo-400 block mb-2 font-medium"
              >
                Provide link to the game
              </label>
              {isInvalidLink && (
                <p className="text-red-500 text-sm mb-2">
                  Invalid game link. Please check and try again.
                </p>
              )}
              <input
                type="text"
                id="link"
                value={gameLink}
                onChange={(e) => setGameLink(e.target.value)}
                className="w-80 border-2 focus:outline-none focus:ring-0 focus:border-indigo-300/50 border-indigo-300/50 bg-transparent p-0.5 rounded"
              />
            </div>
            <Button
              onClick={() => {
                if (isValidGameLink(gameLink)) {
                  const parsedId = parseGameIdFromLink(gameLink);
                  if (parsedId) {
                    navigate(`/game/${parsedId}`);
                  }
                } else {
                  setIsInvalidLink(true);
                }
              }}
              label="Enter the game"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
