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
  const [specUrl, setSpecUrl] = useState<string | null>(null);
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
      // Scalar's own fetch cannot answer the BFF DPoP challenge. Remove the
      // BFF URL here; it is replaced with a blob URL after the spec is fetched.
      const reference = doc.querySelector("#api-reference");
      const url = reference?.getAttribute("data-url") ?? null;
      reference?.removeAttribute("data-url");
      script?.remove();
      setMarkup(doc.body.innerHTML);
      setScriptAttrs(attrs);
      setSpecUrl(url);
    };
    void load().catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!scriptAttrs || !hostRef.current) return;
    let blobUrl: string | null = null;
    let active = true;
    const mount = async () => {
      const reference = hostRef.current?.querySelector("#api-reference");
      if (specUrl && reference) {
        const spec = await dpopFetch(specUrl);
        if (active && spec.ok) {
          blobUrl = URL.createObjectURL(
            new Blob([await spec.text()], { type: "application/json" })
          );
          reference.setAttribute("data-url", blobUrl);
        }
      }
      if (!active || !hostRef.current) return;
      const script = document.createElement("script");
      for (const [name, value] of Object.entries(scriptAttrs))
        script.setAttribute(name, value);
      hostRef.current.append(script);
    };
    void mount().catch(() => {});
    return () => {
      active = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [scriptAttrs, specUrl]);

  if (markup === null) return null;
  return (
    <div
      className="reference-standalone"
      ref={hostRef}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
