import React from "react";
import RoutesLinks from "./routes/RoutesLinks.tsx";
import { BrowserRouter as Router } from "react-router";
import './App.css'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext.tsx";

function App() {
  const client = new QueryClient();
  return (
    <React.StrictMode>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Router>
            <RoutesLinks />
          </Router>{" "}
        </AuthProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

export default App;
