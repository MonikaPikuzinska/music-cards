import React, { useState } from "react";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuid, UUIDTypes } from "uuid";
import { useMutation } from "@tanstack/react-query";
import { createSession } from "../../api/api";
import { useAuth } from "../../context/AuthContext";

const Login = () => {  const { signInWithDiscord, signOut,signInWithGmail, user } = useAuth();

  const { id } = useParams();
  const navigate = useNavigate();

  const { mutate, isPending, isError,data } = useMutation({
    mutationFn: (data: { id: UUIDTypes }) => {
      return createSession(data.id);
    },
  });
  const [loginName, setLoginName] = useState<string | null>(null);
  const createGameBoard = () => {
    mutate({
      id: uuid(),
    });console.log(data);
    
  };console.log(user);
  
  const footer = (
    <div className="flex flex-wrap justify-content-end gap-2">
      <Button label="Log in with Discord" onClick={signInWithDiscord} />
          <Button label="Log in with Gimail" onClick={signInWithGmail} />
      <Button label="Log out" onClick={signOut} />
      <Button label="Create a game" onClick={createGameBoard} />
</div>
  );

  return (
    <div>
      <h1>Imagine the music </h1>
      <Card footer={footer} style={{ width: "20rem" }} className="md:w-25rem">
        <InputText
          onChange={(e) => setLoginName(e.target.value)}
          placeholder="Provide your name"
          className="p-inputtext-sm"
        />
      </Card>
    </div>
  );
};

export default Login;
