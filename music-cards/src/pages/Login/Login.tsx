import React from "react";
import styles from "./Login.module.css";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";

const Login = () => {
  const footer = (
    <div className="flex flex-wrap justify-content-end gap-2">
      <Button label="Log in" icon="" />
    </div>
  );

  return (
    <div className={`${styles["login-wrapper"]}`}>
      <h1 className={`${styles["login-header"]}`}>Imagine the music </h1>
      <Card
        footer={footer}
        style={{ width: "20rem" }}
        className="md:w-25rem"
      >
        <InputText placeholder="Provide your name" className="p-inputtext-sm"  />
      </Card>
    </div>
  );
};

export default Login;
