"use client";

import { signDpopProof, type DpopDescriptor } from "@/lib/dpop-proof";

const CHALLENGE_HEADER = "X-AIHUB-DPOP-CHALLENGE";
const REQUEST_CHALLENGE = "X-DPoP-Challenge";
const REQUEST_PROOF = "X-DPoP-Proof";

function decodeChallenge(value: string): DpopDescriptor | null {
  const [body] = value.split(".");
  if (!body) return null;
  const normalized = body.replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  try {
    const parsed = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
      )
    ) as { m?: unknown; u?: unknown; a?: unknown };
    if (
      typeof parsed.m !== "string" ||
      typeof parsed.u !== "string" ||
      typeof parsed.a !== "string"
    )
      return null;
    return { method: parsed.m, url: parsed.u, ath: parsed.a };
  } catch {
    return null;
  }
}

export async function dpopFetch(url: string, init: RequestInit = {}) {
  let response = await fetch(url, init);
  for (let round = 0; round < 2 && response.status === 428; round += 1) {
    const challenge = response.headers.get(CHALLENGE_HEADER);
    if (!challenge) break;
    const descriptor = decodeChallenge(challenge);
    if (!descriptor) break;
    const proof = await signDpopProof(descriptor);
    const headers = new Headers(init.headers);
    headers.set(REQUEST_CHALLENGE, challenge);
    headers.set(REQUEST_PROOF, proof);
    response = await fetch(url, { ...init, headers });
  }
  return response;
}
