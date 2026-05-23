import { useEffect, useRef } from "react";
import { markUserLoggedIn, markUserLoggedOut, markUserLoggedOutKeepalive } from "../api/api";

const HEARTBEAT_MS = 20_000;

/**
 * Keeps the user marked as online while the game tab is alive.
 * Only marks offline on a real close/navigation (pagehide persisted=false).
 * Switching tabs never triggers a logout.
 */
export function useGamePresence(userId: string | undefined, gameId: string) {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!userId || !gameId) return;

    mountedRef.current = true;

    const logoutNow = () => {
      markUserLoggedOutKeepalive(userId);
      void markUserLoggedOut(userId);
    };

    // Mark online immediately on mount and whenever the tab becomes visible again.
    const markOnline = () => {
      if (!mountedRef.current) return;
      void markUserLoggedIn(userId);
    };

    markOnline();

    const heartbeat = window.setInterval(markOnline, HEARTBEAT_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") markOnline();
      // Do NOT log out when the tab is hidden — the user may just be switching tabs.
    };

    // Only log out when the page is truly being unloaded, not when entering bfcache.
    const onPageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) logoutNow();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) markOnline();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      mountedRef.current = false;
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [userId, gameId]);
}
