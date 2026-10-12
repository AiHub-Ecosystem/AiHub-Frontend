"use client";

import { useEffect } from "react";

export function ClearStaleSession() {
  useEffect(() => {
    void fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    }).catch(() => {});
  }, []);

  return null;
}
