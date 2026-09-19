import React from "react";
import RoutesLinks from "./routes/RoutesLinks.tsx";
import { BrowserRouter as Router } from "react-router-dom";
import "./App.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext.tsx";
import { supabaseConfigError } from "./supabase-client";

function App() {
  if (supabaseConfigError) {
    return (
      <div className="min-h-screen bg-gray-100 px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-indigo-600">
          Music Cards isn’t configured
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-gray-700">
          {supabaseConfigError}
        </p>
      </div>
    );
  }

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
