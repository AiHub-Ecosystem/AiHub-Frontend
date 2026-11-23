"use client";

import { useEffect, useState } from "react";
import { dpopFetch } from "@/lib/dpop-fetch";
import {
  currentProofKeyScope,
  getPublicProofKey,
  installProofKeyCookie,
} from "@/lib/web-session-proof-key";

export function ReferenceBody() {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    const version = new URLSearchParams(window.location.search).get("version");
    const query = version ? `?version=${encodeURIComponent(version)}` : "";
    let active = true;
    const load = async () => {
      // Backend enforces DPoP for web sessions. This page is outside Console,
      // so no SessionActivity installs the proof-key cookie for the BFF.
      try {
        const scope = currentProofKeyScope() ?? "aihub:current-session";
        installProofKeyCookie(await getPublicProofKey(scope));
      } catch {
        // A browser without WebCrypto keeps the unbound Bearer path.
      }
      const response = await dpopFetch(`/app/api/docs/reference${query}`);
      if (!active || !response.ok) return;
      setHtml(await response.text());
    };
    void load().catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (html === null) return null;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
