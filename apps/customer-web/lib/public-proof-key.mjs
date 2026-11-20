const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const PROOF_KEY_COOKIE = "aihub_proof_key";
export const PROOF_SCOPE_COOKIE = "aihub_proof_scope";
export const DPOP_CHALLENGE_HEADER = "X-AIHUB-DPOP-CHALLENGE";
export const DPOP_REQUEST_CHALLENGE_HEADER = "X-DPoP-Challenge";
export const DPOP_REQUEST_PROOF_HEADER = "X-DPoP-Proof";
export const DPOP_REQUEST_PROOFS_HEADER = "X-DPoP-Proofs";

export function isPublicProofKey(value) {
  if (!value || typeof value !== "object") return false;
  const key = value;
  return (
    Object.keys(key).length === 4 &&
    key.kty === "EC" &&
    key.crv === "P-256" &&
    typeof key.x === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(key.x) &&
    typeof key.y === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(key.y)
  );
}

export function parsePublicProofKey(raw) {
  if (typeof raw !== "string") return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw));
    return isPublicProofKey(value) ? value : null;
  } catch {
    return null;
  }
}

export function proofKeyFromCookieHeader(header) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== PROOF_KEY_COOKIE) continue;
    return parsePublicProofKey(part.slice(separator + 1));
  }
  return null;
}

export function proofKeyCookie(key) {
  return `${PROOF_KEY_COOKIE}=${encodeURIComponent(JSON.stringify(key))}; Path=/app; Max-Age=${MAX_AGE_SECONDS}; SameSite=Strict; Secure`;
}

export function proofScopeCookie(scope) {
  return `${PROOF_SCOPE_COOKIE}=${encodeURIComponent(scope)}; Path=/app; Max-Age=${MAX_AGE_SECONDS}; SameSite=Strict`;
}

export function expiredProofKeyCookies() {
  return `${PROOF_KEY_COOKIE}=; Path=/app; Max-Age=0; SameSite=Strict`;
}

export function expiredProofScopeCookie() {
  return `${PROOF_SCOPE_COOKIE}=; Path=/app; Max-Age=0; SameSite=Strict`;
}
