import React from "react";
// import { Provider } from "react-redux";
import RoutesLinks from "./routes";
import { BrowserRouter as Router } from "react-router";

// import store from "./redux";
import "./App.css";
import "primereact/resources/themes/lara-light-cyan/theme.css"; //theme
import "primereact/resources/primereact.min.css"; //core css
import "./index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext.tsx";

function App() {
  const client = new QueryClient();
  return (
    <React.StrictMode>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <></>
          <Router>
            <RoutesLinks />
          </Router>{" "}
        </AuthProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

export default App;
