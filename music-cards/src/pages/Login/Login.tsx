import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuid, UUIDTypes } from "uuid";
import { useMutation } from "@tanstack/react-query";
import { createSession } from "../../api/api";
import { useAuth } from "../../context/AuthContext";

const Login = () => {
  const [loginName, setLoginName] = useState<string | null>(null);

  const { signInWithDiscord, signOut, signInWithGmail, user } = useAuth();

  const { id } = useParams();
  const navigate = useNavigate();

  const { mutate } = useMutation({
    mutationFn: (data: { id: UUIDTypes }) => {
      return createSession(data.id);
    },
  });

  const createGameBoard = () => {
    mutate({
      id: uuid(),
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
            <button
              onClick={signInWithDiscord}
              className="m-3 cursor-pointer bg-indigo-400 text-amber-50 px-3 py-1 rounded"
            >
              Log in with Discord
            </button>
            <button
              className="m-3 cursor-pointer bg-indigo-400 text-amber-50 px-3 py-1 rounded"
              onClick={signInWithGmail}
            >
              Log in with Gimail
            </button>
          </div>
        ) : (
          <div className="flex h-full justify-center items-center flex-col">
            <button
              className="mt-3 mb-1 cursor-pointer bg-indigo-400 text-amber-50 px-3 py-1 rounded"
              onClick={createGameBoard}
            >
              Create a game
            </button>
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
                value={""}
                onChange={(e) => console.log(e.target.value)}
                className="w-80 border-2 focus:outline-none focus:ring-0 focus:border-indigo-300/50 border-indigo-300/50 bg-transparent p-0.5 rounded"
              />
            </div>
            <button
              className="m-3 cursor-pointer bg-indigo-400 text-amber-50 px-3 py-1 rounded"
              // onClick={signInWithGmail}
            >
              Enter the game
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
