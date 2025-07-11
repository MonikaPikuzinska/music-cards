import React from "react";
// import { Provider } from "react-redux";
import { router } from "./routes";
import { RouterProvider } from "react-router-dom";
// import store from "./redux";
import "./App.css";
import "primereact/resources/themes/lara-light-cyan/theme.css"; //theme
import "primereact/resources/primereact.min.css"; //core css
import { PrimeReactProvider } from "primereact/api";

function App() {
  return (
    <PrimeReactProvider>
      <></>
      <RouterProvider router={router} />
    </PrimeReactProvider>
  );
}

export default App;
