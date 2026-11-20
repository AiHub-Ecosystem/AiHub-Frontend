"use client";

import { useEffect, useState } from "react";
import { dpopFetch } from "@/lib/dpop-fetch";

export function ReferenceBody() {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    const version = new URLSearchParams(window.location.search).get("version");
    const query = version ? `?version=${encodeURIComponent(version)}` : "";
    let active = true;
    dpopFetch(`/app/api/docs/reference${query}`)
      .then(async (response) => {
        if (!active || !response.ok) return null;
        return await response.text();
      })
      .then((value) => {
        if (active) setHtml(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (html === null) return null;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
