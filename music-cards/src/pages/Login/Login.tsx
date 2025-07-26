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
    <div className="flex  justify-center items-center">
      <h1 className="">Imagine the music </h1>
      <div className="md:w-25rem">
        <button onClick={signInWithDiscord}>Log in with Discord</button>
        <button onClick={signInWithGmail}>Log in with Gimail</button>
        <button onClick={signOut}>Log out</button>
        <button onClick={createGameBoard}>Create a game</button>
      </div>
    </div>
  );
};

export default Login;
