"use client";

import { useEffect } from "react";

/**
 * Marks the document once React has hydrated it, so a browser test waits for
 * working event handlers instead of clicking server-rendered buttons that do
 * nothing yet. Rendered last in the root layout, so its effect runs after the
 * page's own.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}
