import React from "react";
// import { Provider } from "react-redux";
import { router } from "./routes";
import { RouterProvider } from "react-router-dom";
// import store from "./redux";
import "./App.css";
import "primereact/resources/themes/lara-light-indigo/theme.css"; //theme
import "primereact/resources/primereact.min.css"; //core css 

function App() {
  return (
    // <Provider store={store}>
      <RouterProvider router={router} />
    // </Provider>
  );
}

export default App;