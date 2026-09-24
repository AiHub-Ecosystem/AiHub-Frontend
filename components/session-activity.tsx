"use client";

import { useEffect } from "react";

const MIN_TOUCH_INTERVAL = 5 * 60 * 1000;

export function SessionActivity() {
  useEffect(() => {
    let lastTouch = 0;
    const touch = () => {
      if (Date.now() - lastTouch < MIN_TOUCH_INTERVAL) return;
      lastTouch = Date.now();
      void fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      }).catch(() => {});
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
