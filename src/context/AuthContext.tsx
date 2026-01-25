import { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase-client";
import { setOnSpotifyUnauthorized } from "../services/spotifyService";

interface AuthContextType {
  user: User | null;
  signInWithSpotify: (redirectTo?: string) => void;
  signOut: () => Promise<void>;
  authLoading?: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // When Spotify responds with 401, we want to sign the user out and
    // redirect them to login so they can re-authenticate.
    setOnSpotifyUnauthorized(() => {
      (async () => {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.error("Error signing out after spotify 401:", err);
        }
        const current = window.location.href;
        window.location.href = `/login?returnTo=${encodeURIComponent(current)}`;
      })();
    });

    // cleanup: remove the callback on unmount
    return () => setOnSpotifyUnauthorized(null);
  }, []);

  const signInWithSpotify = (redirectTo?: string) => {
    if (redirectTo) {
      supabase.auth.signInWithOAuth({
        provider: "spotify",
        options: { redirectTo },
      });
    } else {
      supabase.auth.signInWithOAuth({ provider: "spotify" });
    }
  };
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, signInWithSpotify, signOut, authLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within the AuthProvider");
  }
  return context;
};
