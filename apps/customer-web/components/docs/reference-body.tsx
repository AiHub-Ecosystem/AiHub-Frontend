"use client";

import { useEffect, useRef, useState } from "react";
import { dpopFetch } from "@/lib/dpop-fetch";
import {
  currentProofKeyScope,
  getPublicProofKey,
  installProofKeyCookie,
} from "@/lib/web-session-proof-key";

export function ReferenceBody() {
  const [markup, setMarkup] = useState<string | null>(null);
  const [scriptAttrs, setScriptAttrs] = useState<Record<string, string> | null>(
    null
  );
  const hostRef = useRef<HTMLDivElement>(null);

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
      const html = await response.text();
      // innerHTML does not execute scripts. Split the Scalar CDN script out so
      // it can be appended as a real element and actually mount the UI.
      const doc = new DOMParser().parseFromString(html, "text/html");
      const script = doc.querySelector("script[src]");
      const attrs = script
        ? Object.fromEntries(
            [...script.attributes].map((attr) => [attr.name, attr.value])
          )
        : null;
      script?.remove();
      setMarkup(doc.body.innerHTML);
      setScriptAttrs(attrs);
    };
    void load().catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!scriptAttrs || !hostRef.current) return;
    const script = document.createElement("script");
    for (const [name, value] of Object.entries(scriptAttrs))
      script.setAttribute(name, value);
    hostRef.current.append(script);
    return () => script.remove();
  }, [scriptAttrs]);

  if (markup === null) return null;
  return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: markup }} />;
}
