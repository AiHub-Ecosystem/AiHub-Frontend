"use client";

import {
  currentProofKeyScope,
  getStoredProofKey,
} from "@/lib/web-session-proof-key";

const encoder = new TextEncoder();

function base64url(input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export type DpopDescriptor = { method: string; url: string; ath: string };

export async function signDpopProof(input: DpopDescriptor) {
  const scope = currentProofKeyScope();
  if (!scope) throw new Error("Proof key scope is missing");
  const { privateKey, publicJwk } = await getStoredProofKey(scope);
  const header = base64url(
    encoder.encode(
      JSON.stringify({ typ: "dpop+jwt", alg: "ES256", jwk: publicJwk })
    )
  );
  const payload = base64url(
    encoder.encode(
      JSON.stringify({
        htm: input.method,
        htu: input.url,
        ath: input.ath,
        jti: crypto.randomUUID(),
        iat: Math.floor(Date.now() / 1000),
      })
    )
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    encoder.encode(`${header}.${payload}`)
  );
  return `${header}.${payload}.${base64url(signature)}`;
}
