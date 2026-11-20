import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const DPOP_CHALLENGE_HEADER = "X-AIHUB-DPOP-CHALLENGE";
export const DPOP_REQUEST_CHALLENGE_HEADER = "X-DPoP-Challenge";
export const DPOP_REQUEST_PROOF_HEADER = "X-DPoP-Proof";
export const DPOP_REQUIRED_CODE = "DPOP_PROOF_REQUIRED";
export const DPOP_INVALID_CODE = "DPOP_PROOF_INVALID";

type Challenge = {
  v: number;
  s: string;
  m: string;
  u: string;
  a: string;
  e: number;
  n: string;
};

type Descriptor = {
  sessionToken: string;
  method: string;
  url: string;
  accessToken: string;
};

function key() {
  const secret = process.env.AIHUB_WEB_SESSION_CLIENT_SECRET ?? "";
  return createHash("sha256").update(`aihub-dpop-challenge:${secret}`).digest();
}

export function accessTokenHash(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function sign(body: string) {
  return createHmac("sha256", key()).update(body).digest("base64url");
}

export function createDpopChallenge(input: Descriptor) {
  const payload: Challenge = {
    v: 1,
    s: accessTokenHash(input.sessionToken),
    m: input.method,
    u: input.url,
    a: accessTokenHash(input.accessToken),
    e: Math.floor(Date.now() / 1000) + 60,
    n: randomBytes(16).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeDpopChallenge(value: string | null | undefined) {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as Challenge;
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

export function verifyDpopChallenge(
  value: string | null | undefined,
  input: Descriptor
) {
  if (!value) return false;
  const [body, signature] = value.split(".");
  if (!body || !signature) return false;
  const expected = sign(body);
  if (signature.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
    return false;
  const payload = decodeDpopChallenge(value);
  if (!payload) return false;
  return (
    payload.v === 1 &&
    payload.e > Math.floor(Date.now() / 1000) &&
    payload.s === accessTokenHash(input.sessionToken) &&
    payload.m === input.method &&
    payload.u === input.url &&
    payload.a === accessTokenHash(input.accessToken)
  );
}
