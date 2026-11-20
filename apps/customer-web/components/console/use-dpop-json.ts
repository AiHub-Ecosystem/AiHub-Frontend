"use client";

import { useEffect, useState } from "react";
import { dpopFetch } from "@/lib/dpop-fetch";

export function useDpopJson<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

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
      .catch((error) => {
        if (active) {
          setData({ error: String(error) } as T);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [url]);

  return { data, loading };
}
