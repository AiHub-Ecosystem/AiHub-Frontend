"use client";

import { useEffect } from "react";

const MIN_TOUCH_INTERVAL = 60 * 60 * 1000;
const LAST_TOUCH_KEY = "aihub:web-session-last-exchange";

export function SessionActivity() {
  useEffect(() => {
    let lastTouch = Number(sessionStorage.getItem(LAST_TOUCH_KEY)) || 0;
    let pending = false;
    const touch = async () => {
      if (pending || Date.now() - lastTouch < MIN_TOUCH_INTERVAL) return;
      pending = true;
      try {
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
        });
        if (response.status === 204) {
          lastTouch = Date.now();
          sessionStorage.setItem(LAST_TOUCH_KEY, String(lastTouch));
        } else if (response.status === 401) {
          window.location.reload();
        }
      } catch {
        // A failed activity check stays eligible for the next user interaction.
      } finally {
        pending = false;
      }
    };

    touch();
    window.addEventListener("pointerdown", touch, { passive: true });
    window.addEventListener("keydown", touch);
    window.addEventListener("focus", touch);
    const reloadProtectedPage = () => window.location.reload();
    const reloadIfRestored = (event: PageTransitionEvent) => {
      if (event.persisted) reloadProtectedPage();
    };
    window.addEventListener("popstate", reloadProtectedPage);
    window.addEventListener("pageshow", reloadIfRestored);
    return () => {
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      window.removeEventListener("focus", touch);
      window.removeEventListener("popstate", reloadProtectedPage);
      window.removeEventListener("pageshow", reloadIfRestored);
    };
  }, []);

  return null;
}
