import { useEffect, useRef } from "react";
import {
  markUserLoggedIn,
  markUserLoggedOut,
  markUserLoggedOutKeepalive,
} from "../api/api";

const HEARTBEAT_MS = 25_000;
/** Only used when the tab stays hidden without a bfcache pagehide (backup for close). */
const HIDDEN_LOGOUT_DELAY_MS = 5_000;
const LAST_TAB_CHECK_MS = 300;

type PresenceMessage =
  | { type: "ping"; tabId: string }
  | { type: "pong"; tabId: string };

/**
 * Keeps the user online while the game tab is active.
 * Logs out on tab/window close, not when briefly switching tabs.
 */
export function useGamePresence(userId: string | undefined, gameId: string) {
  const hiddenLogoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    if (!userId || !gameId) return;

    const channelName = `game-presence-${userId}-${gameId}`;
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(channelName)
        : null;

    const tabId = crypto.randomUUID();

    const clearHiddenLogoutTimer = () => {
      if (hiddenLogoutTimerRef.current != null) {
        clearTimeout(hiddenLogoutTimerRef.current);
        hiddenLogoutTimerRef.current = null;
      }
    };

    const markOnline = () => {
      clearHiddenLogoutTimer();
      void markUserLoggedIn(userId);
    };

    const logoutNow = () => {
      clearHiddenLogoutTimer();
      markUserLoggedOutKeepalive(userId);
      void markUserLoggedOut(userId);
    };

    const logoutIfLastTab = () => {
      if (!channel) {
        logoutNow();
        return;
      }

      let otherTabAlive = false;

      const onReply = (event: MessageEvent<PresenceMessage>) => {
        const msg = event.data;
        if (msg?.tabId !== tabId && msg?.type === "pong") {
          otherTabAlive = true;
        }
      };

      channel.addEventListener("message", onReply);
      channel.postMessage({ type: "ping", tabId });

      window.setTimeout(() => {
        channel.removeEventListener("message", onReply);
        if (!otherTabAlive) logoutNow();
      }, LAST_TAB_CHECK_MS);
    };

    const scheduleLogoutAfterHide = () => {
      clearHiddenLogoutTimer();
      hiddenLogoutTimerRef.current = setTimeout(() => {
        hiddenLogoutTimerRef.current = null;
        logoutIfLastTab();
      }, HIDDEN_LOGOUT_DELAY_MS);
    };

    const onChannelMessage = (event: MessageEvent<PresenceMessage>) => {
      const msg = event.data;
      if (!msg?.tabId || msg.tabId === tabId) return;
      if (msg.type === "ping") {
        channel?.postMessage({ type: "pong", tabId });
      }
    };

    channel?.addEventListener("message", onChannelMessage);

    markOnline();

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") markOnline();
    }, HEARTBEAT_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markOnline();
      } else {
        scheduleLogoutAfterHide();
      }
    };

    const onPageHide = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Tab switch (bfcache) — do not log out; pageshow / visibility will mark online again.
        clearHiddenLogoutTimer();
        return;
      }
      logoutIfLastTab();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) markOnline();
    };

    const onUnload = () => {
      logoutNow();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("unload", onUnload);

    return () => {
      window.clearInterval(heartbeat);
      clearHiddenLogoutTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("unload", onUnload);
      channel?.removeEventListener("message", onChannelMessage);
      channel?.close();
      logoutIfLastTab();
    };
  }, [userId, gameId]);
}
