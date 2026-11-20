"use client";

import { useEffect, useState } from "react";
import { dpopFetch } from "@/lib/dpop-fetch";

export const REFRESH_EVENT = "aihub:dpop-refresh";

export function useDpopJson<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const onRefresh = () => setReload((value) => value + 1);
    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REFRESH_EVENT, onRefresh);
  }, []);

  useEffect(() => {
    let active = true;
    dpopFetch(url, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as T;
      })
      .then((value) => {
        if (!active) return;
        setData(value);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [url, reload]);

  return { data, loading };
}
