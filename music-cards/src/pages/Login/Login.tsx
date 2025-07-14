import React, { useState } from "react";
import styles from "./Login.module.css";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { useNavigate } from "react-router-dom";
import { v4 as uuid } from "uuid";

const Login = () => {
  const navigate = useNavigate();

  const [loginName, setLoginName] = useState<string | null>(null);

  const footer = (
    <div className="flex flex-wrap justify-content-end gap-2">
      <Button label="Log in" onClick={() => navigate(`/game/${uuid()}`)} />
    </div>
  );

  return (
    <div className={`${styles["login-wrapper"]}`}>
      <h1 className={`${styles["login-header"]}`}>Imagine the music </h1>
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
