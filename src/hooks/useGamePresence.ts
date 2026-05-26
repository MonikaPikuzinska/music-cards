import { useEffect, useRef } from "react";
import { markUserLoggedIn } from "../api/api";

const HEARTBEAT_MS = 20_000;

/** Keeps is_logged true in the DB while the game tab is open. */
export function useGamePresence(userId: string | undefined, gameId: string) {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!userId || !gameId) return;

    mountedRef.current = true;

    const markOnline = () => {
      if (!mountedRef.current) return;
      void markUserLoggedIn(userId);
    };

    markOnline();
    const heartbeat = window.setInterval(markOnline, HEARTBEAT_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") markOnline();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mountedRef.current = false;
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [userId, gameId]);
}
