export type PublicProofKey = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
};

export const PROOF_KEY_COOKIE: string;
export const PROOF_SCOPE_COOKIE: string;
export const DPOP_CHALLENGE_HEADER: string;
export const DPOP_REQUEST_CHALLENGE_HEADER: string;
export const DPOP_REQUEST_PROOF_HEADER: string;

export function isPublicProofKey(value: unknown): value is PublicProofKey;
export function parsePublicProofKey(raw: unknown): PublicProofKey | null;
export function proofKeyFromCookieHeader(
  header: string | null | undefined
): PublicProofKey | null;
export function proofKeyCookie(key: PublicProofKey): string;
export function proofScopeCookie(scope: string): string;
export function expiredProofKeyCookies(): string;
export function expiredProofScopeCookie(): string;
