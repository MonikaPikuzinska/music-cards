import { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase-client";

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
