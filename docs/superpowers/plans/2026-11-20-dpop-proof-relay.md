# DPoP Proof Relay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every bound Web Session token used by Customer Web reach AIHUB with a browser-signed DPoP proof, while unbound sessions keep Bearer unchanged.

**Architecture:** BFF issues a short-lived stateless HMAC challenge when a bound token has no proof. The browser signs an ES256 proof with its non-extractable IndexedDB key and retries the BFF request with challenge + proof headers. Console data reads move to client components so the browser is present for signing. AIHUB mode stays `verify`; `enforce` rollout remains #124.

**Tech Stack:** Next.js 16 route handlers + client components, WebCrypto (ES256, SHA-256), Node `crypto` for HMAC in server-only module, Vitest, Playwright, existing AIHUB mock server.

## Global Constraints

- Private key must stay non-extractable in the browser; never export or send it.
- `token_type` remains `Bearer`; only `dpop_bound` selects DPoP vs Bearer.
- No new environment variables: derive HMAC key from `AIHUB_WEB_SESSION_CLIENT_SECRET`.
- Unbound tokens must keep current Bearer behaviour, including the existing single 401 refresh retry.
- Proof fields: protected header `typ: dpop+jwt`, `alg: ES256`, `jwk` (only `kty`, `crv`, `x`, `y`); payload `htm`, `htu`, `ath`, `jti`, `iat`.
- `htu` = upstream origin + pathname only; no query or fragment.
- Challenge lifetime: 60 seconds. Allow at most two proof round-trips per BFF call (first call, then one after a 401 refresh).

---

### Task 1: Stateless DPoP challenge module

**Files:**

- Create: `apps/customer-web/lib/dpop-challenge.ts`
- Test: `tests/unit/dpop-challenge.test.ts`

**Interfaces:**

- Consumes: `AIHUB_WEB_SESSION_CLIENT_SECRET` env.
- Produces: `DPOP_CHALLENGE_HEADER`, `DPOP_REQUEST_CHALLENGE_HEADER`, `DPOP_REQUEST_PROOF_HEADER`, `DPOP_REQUIRED_CODE`, `DPOP_INVALID_CODE`, `accessTokenHash(token)`, `createDpopChallenge({sessionToken, method, url, accessToken})`, `verifyDpopChallenge(value, {sessionToken, method, url, accessToken})`, `decodeDpopChallenge(value)`.

- [ ] **Step 1: Write the failing test**

`tests/unit/dpop-challenge.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  accessTokenHash,
  createDpopChallenge,
  decodeDpopChallenge,
  verifyDpopChallenge,
} from "@/lib/dpop-challenge";

const input = {
  sessionToken: "w".repeat(43),
  method: "POST",
  url: "http://127.0.0.1:3101/v1/organizations",
  accessToken: "jwt-bound",
};

describe("DPoP challenge", () => {
  it("round-trips a challenge bound to session, method, url and token hash", () => {
    process.env.AIHUB_WEB_SESSION_CLIENT_SECRET = "server-only-secret";
    const challenge = createDpopChallenge(input);
    const decoded = decodeDpopChallenge(challenge)!;

    expect(decoded).toMatchObject({
      v: 1,
      s: expect.any(String),
      m: "POST",
      u: input.url,
      a: accessTokenHash("jwt-bound"),
    });
    expect(decoded.e).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(verifyDpopChallenge(challenge, input)).toBe(true);
  });

  it("rejects tampering, expiry and descriptor mismatch", () => {
    process.env.AIHUB_WEB_SESSION_CLIENT_SECRET = "server-only-secret";
    const challenge = createDpopChallenge(input);
    const [body] = challenge.split(".");
    const tampered = Buffer.from(
      JSON.stringify({ ...decodeDpopChallenge(challenge), m: "GET" })
    ).toString("base64url");

    expect(verifyDpopChallenge(`${tampered}.bad`, input)).toBe(false);
    expect(verifyDpopChallenge(challenge, { ...input, method: "GET" })).toBe(
      false
    );
    expect(
      verifyDpopChallenge(challenge, { ...input, accessToken: "other" })
    ).toBe(false);
    expect(verifyDpopChallenge(`${body}.`, input)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/dpop-challenge.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write minimal implementation**

`apps/customer-web/lib/dpop-challenge.ts`:

```ts
import "server-only";
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/dpop-challenge.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/customer-web/lib/dpop-challenge.ts tests/unit/dpop-challenge.test.ts
git commit -m "feat(auth): add stateless DPoP challenge (#123)"
```

---

### Task 2: BFF issues challenges and relays DPoP proofs

**Files:**

- Modify: `apps/customer-web/lib/auth-session.ts` (replace `authenticatedAihubFetch`, lines 306-345)
- Test: `tests/unit/auth-session.test.ts`

**Interfaces:**

- Consumes: Task 1 exports.
- Produces: `authenticatedAihubFetch` now returns 428 with `X-AIHUB-DPOP-CHALLENGE` for bound tokens without a valid challenge; accepts `X-DPoP-Challenge` + `X-DPoP-Proof`.

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/auth-session.test.ts` (add `import { createHash } from "node:crypto";` at the top of the file):

```ts
function makeProof(claims: { method: string; url: string; ath: string }) {
  const header = Buffer.from(
    JSON.stringify({
      typ: "dpop+jwt",
      alg: "ES256",
      jwk: { kty: "EC", crv: "P-256", x: "x".repeat(43), y: "y".repeat(43) },
    })
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      htm: claims.method,
      htu: claims.url,
      ath: claims.ath,
      jti: "unique-jti",
      iat: Math.floor(Date.now() / 1000),
    })
  ).toString("base64url");
  return `${header}.${payload}.signature`;
}

async function boundSession(sessionToken: string) {
  process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      data: {
        access_token: "jwt-bound",
        token_type: "Bearer",
        expires_in: aihubLimits.webSessionAccessTokenMaxSeconds,
        dpop_bound: true,
      },
    })
  );
  await getCurrentWebSession(sessionToken, undefined, proofKey);
  return fetch;
}

it("returns a DPoP challenge for a bound token without a proof", async () => {
  const sessionToken = "c".repeat(43);
  const fetch = await boundSession(sessionToken);
  fetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));

  const response = await authenticatedAihubFetch(
    new Request(`${origin}/app/api/organizations`, { method: "GET" }),
    sessionToken,
    "/v1/organizations/me/members"
  );

  expect(response.status).toBe(428);
  expect(response.headers.get("X-AIHUB-DPOP-CHALLENGE")).toBeTruthy();
  expect((await response.json()).error.code).toBe("DPOP_PROOF_REQUIRED");
});

it("sends DPoP headers when a valid challenge and proof are supplied", async () => {
  const sessionToken = "d".repeat(43);
  const fetch = await boundSession(sessionToken);
  fetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
  const first = await authenticatedAihubFetch(
    new Request(`${origin}/app/api/organizations`, { method: "GET" }),
    sessionToken,
    "/v1/organizations/me/members"
  );
  const challenge = first.headers.get("X-AIHUB-DPOP-CHALLENGE")!;
  const ath = createHash("sha256").update("jwt-bound").digest("base64url");

  fetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
  const response = await authenticatedAihubFetch(
    new Request(`${origin}/app/api/organizations`, {
      method: "GET",
      headers: {
        "X-DPoP-Challenge": challenge,
        "X-DPoP-Proof": makeProof({
          method: "GET",
          url: "http://127.0.0.1:3101/v1/organizations/me/members",
          ath,
        }),
      },
    }),
    sessionToken,
    "/v1/organizations/me/members"
  );

  expect(response.status).toBe(200);
  const upstreamInit = fetch.mock.calls.at(-1)?.[1];
  const headers = new Headers(upstreamInit?.headers);
  expect(headers.get("authorization")).toBe("DPoP jwt-bound");
  expect(headers.get("dpop")).toMatch(/\.signature$/);
});

it("keeps Bearer for unbound tokens", async () => {
  process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
  const unboundToken = "u".repeat(43);
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      data: {
        access_token: "jwt-unbound",
        token_type: "Bearer",
        expires_in: aihubLimits.webSessionAccessTokenMaxSeconds,
      },
    })
  );
  await getCurrentWebSession(unboundToken, undefined);
  fetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));

  await authenticatedAihubFetch(
    new Request(`${origin}/app/api/organizations`, { method: "GET" }),
    unboundToken,
    "/v1/organizations/me/members"
  );

  const headers = new Headers(fetch.mock.calls.at(-1)?.[1]?.headers);
  expect(headers.get("authorization")).toBe("Bearer jwt-unbound");
});
```

Add `"c".repeat(43)` and `"d".repeat(43)` to the `afterEach` cleanup token list.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/auth-session.test.ts`
Expected: FAIL, challenge assertions/status 428 missing.

- [ ] **Step 3: Replace `authenticatedAihubFetch`**

```ts
import {
  accessTokenHash,
  createDpopChallenge,
  DPOP_CHALLENGE_HEADER,
  DPOP_INVALID_CODE,
  DPOP_REQUEST_CHALLENGE_HEADER,
  DPOP_REQUEST_PROOF_HEADER,
  DPOP_REQUIRED_CODE,
  verifyDpopChallenge,
} from "@/lib/dpop-challenge";

function dpopProofClaims(proof: string) {
  const [, payload] = proof.split(".");
  if (!payload) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as {
      htm?: unknown;
      htu?: unknown;
      ath?: unknown;
      jti?: unknown;
      iat?: unknown;
    };
    if (
      typeof parsed.htm !== "string" ||
      typeof parsed.htu !== "string" ||
      typeof parsed.ath !== "string" ||
      typeof parsed.jti !== "string" ||
      typeof parsed.iat !== "number"
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

function dpopResponse(code: string, challenge?: string) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  });
  if (challenge) headers.set(DPOP_CHALLENGE_HEADER, challenge);
  return Response.json(
    { success: false, error: { code } },
    {
      status: code === DPOP_REQUIRED_CODE ? 428 : 400,
      headers,
    }
  );
}

export async function authenticatedAihubFetch(
  request: Request,
  token: string,
  path: string,
  init: RequestInit = {}
) {
  const destination = new URL(path, aihubUrl("/"));
  if (destination.origin !== new URL(aihubUrl("/")).origin)
    throw new Error("AIHUB path must be same-origin");

  const method = (init.method ?? "GET").toUpperCase();
  const htu = `${destination.origin}${destination.pathname}`;
  const endUserIp = endUserIpFromHeaders(request.headers);
  const proofKey = clientProofKeyFromHeaders(request.headers);
  let session = await getCurrentWebSession(token, endUserIp, proofKey);
  if (!session)
    return authRequired({
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    });

  const descriptor = {
    sessionToken: token,
    method,
    url: htu,
    accessToken: session.accessToken,
  };
  const challenge = request.headers.get(DPOP_REQUEST_CHALLENGE_HEADER);
  const proof = request.headers.get(DPOP_REQUEST_PROOF_HEADER);
  if (session.dpopBound) {
    if (!verifyDpopChallenge(challenge, descriptor))
      return dpopResponse(DPOP_REQUIRED_CODE, createDpopChallenge(descriptor));
    const claims = proof ? dpopProofClaims(proof) : null;
    if (
      !claims ||
      claims.htm !== method ||
      claims.htu !== htu ||
      claims.ath !== accessTokenHash(session.accessToken)
    )
      return dpopResponse(DPOP_INVALID_CODE);
  }

  const send = (accessToken: string) => {
    const headers = new Headers(init.headers);
    if (session!.dpopBound) {
      headers.set("Authorization", `DPoP ${accessToken}`);
      headers.set("DPoP", proof!);
    } else {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
    return fetch(destination, {
      ...init,
      headers,
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(8_000),
    });
  };

  const response = await send(session.accessToken);
  if (response.status !== 401) return response;

  sessions.delete(token);
  session = await getCurrentWebSession(token, endUserIp, proofKey);
  if (!session)
    return authRequired({
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    });
  if (!session.dpopBound) return send(session.accessToken);
  return dpopResponse(
    DPOP_REQUIRED_CODE,
    createDpopChallenge({
      sessionToken: token,
      method,
      url: htu,
      accessToken: session.accessToken,
    })
  );
}
```

- [ ] **Step 4: Run full unit suite**

Run: `npm test`
Expected: all tests pass, including the three new cases and existing Bearer/unbound tests.

- [ ] **Step 5: Commit**

```bash
git add apps/customer-web/lib/auth-session.ts tests/unit/auth-session.test.ts
git commit -m "feat(auth): challenge and relay DPoP proofs in BFF (#123)"
```

---

### Task 3: Browser proof signing and dpopFetch

**Files:**

- Modify: `apps/customer-web/lib/web-session-proof-key.ts` (add `getStoredProofKey`)
- Create: `apps/customer-web/lib/dpop-proof.ts`
- Create: `apps/customer-web/lib/dpop-fetch.ts`

**Interfaces:**

- Consumes: `currentProofKeyScope()` from `web-session-proof-key.ts`; `DPOP_CHALLENGE_HEADER`, `DPOP_REQUEST_CHALLENGE_HEADER`, `DPOP_REQUEST_PROOF_HEADER` strings (duplicated as literals on the client because the server module is `server-only`).
- Produces: `signDpopProof({method,url,ath})`, `dpopFetch(url, init)`.

- [ ] **Step 1: Export stored key access**

In `apps/customer-web/lib/web-session-proof-key.ts`, add after `getPublicProofKey`:

```ts
/** Private key for signing; never extractable or serialized to the network. */
export function getStoredProofKey(scope: string) {
  const normalized = normalizeScope(scope);
  let key = pending.get(normalized);
  if (!key) {
    key = loadOrCreate(normalized).finally(() => pending.delete(normalized));
    pending.set(normalized, key);
  }
  return key;
}
```

- [ ] **Step 2: Write client proof signer**

`apps/customer-web/lib/dpop-proof.ts`:

```ts
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
    "ECDSA",
    privateKey,
    encoder.encode(`${header}.${payload}`)
  );
  return `${header}.${payload}.${base64url(signature)}`;
}
```

- [ ] **Step 3: Write dpopFetch**

`apps/customer-web/lib/dpop-fetch.ts`:

```ts
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
```

`dpopFetch` deliberately allows two rounds: the first challenge and one fresh challenge after an upstream 401 refresh.

- [ ] **Step 4: Verify types and unit suite**

Run: `npx tsc --noEmit && npm test`
Expected: no errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/customer-web/lib/web-session-proof-key.ts apps/customer-web/lib/dpop-proof.ts apps/customer-web/lib/dpop-fetch.ts
git commit -m "feat(auth): sign DPoP proofs and retry BFF calls (#123)"
```

---

### Task 4: Teach the AIHUB mock to verify DPoP proofs

**Files:**

- Modify: `tests/e2e/mock-aihub-server.mjs`
- Test: `tests/e2e/auth.spec.ts` (add one bound-case assertion)

**Interfaces:**

- Consumes: issued access token strings `access-token-<n>` from the exchange handler.
- Produces: recorded `scheme` and `proofValid` on each `authRequests` exchange-adjacent entry.

- [ ] **Step 1: Add a proof verifier**

Near the existing `isPublicProofKey` import/helper area in `tests/e2e/mock-aihub-server.mjs`:

```js
const decodePart = (value) =>
  JSON.parse(
    Buffer.from(
      value.replace(/-/gu, "+").replace(/_/gu, "/"),
      "base64url"
    ).toString()
  );

function verifyDpopProof(proof, { method, url, accessToken }) {
  if (typeof proof !== "string") return false;
  const [headerPart, payloadPart, signaturePart] = proof.split(".");
  if (!headerPart || !payloadPart || !signaturePart) return false;
  try {
    const header = decodePart(headerPart);
    const payload = decodePart(payloadPart);
    if (
      header.typ !== "dpop+jwt" ||
      header.alg !== "ES256" ||
      !isPublicProofKey(header.jwk)
    )
      return false;
    const ath = createHash("sha256").update(accessToken).digest("base64url");
    const now = Math.floor(Date.now() / 1000);
    return (
      payload.htm === method &&
      payload.htu === url &&
      payload.ath === ath &&
      typeof payload.jti === "string" &&
      typeof payload.iat === "number" &&
      Math.abs(now - payload.iat) <= 60
    );
  } catch {
    return false;
  }
}
```

Also declare `const boundAccessTokens = new Set();` and `const seenDpopJti = new Set();` near the mock's other state, and reject a proof whose `jti` is already present.

- [ ] **Step 2: Record and enforce the scheme on protected routes**

At the top of the protected `/v1/*` handler (before routing), after reading `request.method` and `pathname`:

```js
const authorization = request.headers.authorization ?? "";
const dpopProof = request.headers.dpop;
const dpopBound =
  /^Bearer access-token-/u.test(authorization) &&
  boundAccessTokens.has(authorization.slice("Bearer ".length));
if (dpopBound) {
  const ok =
    authorization.startsWith("DPoP ") &&
    verifyDpopProof(dpopProof, {
      method: request.method,
      url: `http://127.0.0.1:3101${pathname}`,
      accessToken: authorization.slice("DPoP ".length),
    });
  authRequests.push({
    path: "dpop",
    scheme: "dpop",
    proofValid: ok,
  });
  if (!ok) {
    sendJson(response, 401, {
      error: { code: "AUTH_USER_ACCESS_TOKEN_INVALID" },
    });
    return;
  }
} else {
  authRequests.push({ path: "dpop", scheme: "bearer", proofValid: null });
}
```

In the exchange handler, add each issued `access-token-<n>` to `boundAccessTokens` when `dpop_bound: true` is returned.

- [ ] **Step 3: Add browser assertion**

In `tests/e2e/auth.spec.ts`, in the existing bound-key test after sign-in, add:

```ts
const logged = await request.get(`${mockUrl}/__test__/auth/requests`);
const authRequests = (await logged.json()).requests;
expect(
  authRequests.some(
    (entry: { path: string; proofValid?: boolean }) =>
      entry.path === "dpop" && entry.proofValid === true
  )
).toBe(true);
```

- [ ] **Step 4: Run targeted e2e**

Run: `npx playwright test tests/e2e/auth.spec.ts -g "browser proof key survives"`
Expected: PASS with a recorded valid DPoP proof.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/mock-aihub-server.mjs tests/e2e/auth.spec.ts
git commit -m "test(mock): verify DPoP proofs in AIHUB mock (#123)"
```

---

### Task 5: Move Console data reads to client fetch

**Files:**

- Create: `apps/customer-web/components/console/use-dpop-json.ts`
- Create: `apps/customer-web/components/console/console-data.tsx`
- Modify: the six Console pages listed below, and `tests/e2e/organizations.spec.ts` if hydration timing changes.
- Delete: `apps/customer-web/app/docs/reference/route.ts`
- Create: `apps/customer-web/app/api/docs/reference/route.ts`, `apps/customer-web/app/docs/reference/page.tsx`

**Interfaces:**

- Consumes: `dpopFetch` from Task 3.
- Produces: `useDpopJson<T>(url)` returning `{ data: T | null; loading: boolean }`; `<ConsoleRoster ... />` and `<ConsoleApiKeys ... />` client components.

- [ ] **Step 1: Write the client hook**

`apps/customer-web/components/console/use-dpop-json.ts`:

```ts
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
        if (!active || !response.ok) return null;
        return (await response.json()) as T;
      })
      .then((value) => {
        if (active) {
          setData(value);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [url]);

  return { data, loading };
}
```

- [ ] **Step 2: Create client data components**

`apps/customer-web/components/console/console-data.tsx`:

```tsx
"use client";

import { RosterUnavailable } from "@/components/organizations/roster-unavailable";
import { useDpopJson } from "@/components/console/use-dpop-json";
import type { OrganizationMembership } from "@/lib/organizations";
import type { OrganizationApiKey } from "@/lib/api-keys";

type RosterResponse = { data?: OrganizationMembership[] };
type ApiKeysResponse = { data?: OrganizationApiKey[] };

export function ConsoleRoster({
  children,
}: {
  children: (roster: OrganizationMembership[]) => React.ReactNode;
}) {
  const { data, loading } = useDpopJson<RosterResponse>(
    "/app/api/organizations/me/members"
  );
  if (loading) return null;
  if (!data?.data) return <RosterUnavailable />;
  return <>{children(data.data)}</>;
}

export function ConsoleApiKeys({
  organizationId,
  children,
}: {
  organizationId: string;
  children: (keys: OrganizationApiKey[]) => React.ReactNode;
}) {
  const { data, loading } = useDpopJson<ApiKeysResponse>(
    `/app/api/organizations/${encodeURIComponent(organizationId)}/api-keys`
  );
  if (loading) return null;
  if (!data?.data) return <p role="alert">Không tải được danh sách API key.</p>;
  return <>{children(data.data)}</>;
}
```

Server pages may pass JSX through `children` as a function only from a Client Component; therefore each page below must render its body from a new small client component that calls these helpers. Keep the existing markup and labels verbatim when moving it.

- [ ] **Step 3: Convert the roster pages**

For each of `app/console/page.tsx`, `app/console/orgs/page.tsx`, `app/console/orgs/[organizationId]/page.tsx`, `app/console/orgs/[organizationId]/api-keys/page.tsx`, and `app/console/orgs/[organizationId]/identity/page.tsx`:

- keep `metadata`, `dynamic`, and `requirePageWebSession` in the server page;
- remove the `readOrganizationRoster` import/call;
- render a new client component in the same folder named `body.tsx` that calls `useDpopJson<RosterResponse>("/app/api/organizations/me/members")` and reproduces the page's existing JSX using the fetched roster (including duplicate-name handling, redirects via `redirect()` are not available in client components — replace them with `window.location.replace()`);
- pass `organizationId`/`query` from the server page as props.

- [ ] **Step 4: Convert the quickstart page**

For `app/console/orgs/[organizationId]/api-keys/[apiKeyId]/quickstart/page.tsx`, create `body.tsx` that uses `useDpopJson` for both `/app/api/organizations/me/members` and the organization's `/api-keys` route, then reproduces the existing JSX, `notFound()` equivalent via `window.location.replace("/app/console/orgs")`, and `randomUUID()` inside the client component.

- [ ] **Step 5: Convert docs reference**

Delete `apps/customer-web/app/docs/reference/route.ts` (a route handler cannot coexist with a page at the same segment). Create `apps/customer-web/app/api/docs/reference/route.ts` as the BFF handler: keep `VERSION`, `referenceHtml()`, and the existing `authenticatedAihubFetch` call, but return the transformed HTML text instead of a page. Create `apps/customer-web/app/docs/reference/page.tsx` with the existing metadata that renders `<ReferenceBody />`. Create `apps/customer-web/components/docs/reference-body.tsx` as a client component that calls `dpopFetch(\`/app/api/docs/reference${versionQuery}\`)`, reads `await response.text()`, and renders it with `dangerouslySetInnerHTML`. The browser is therefore present for proof signing.

- [ ] **Step 6: Run browser suite**

Run: `npx playwright test tests/e2e/organizations.spec.ts tests/e2e/protected-openapi.spec.ts`
Expected: all tests pass; if a test asserted server-rendered content before hydration, add `await waitForHydration(page)` rather than weakening assertions.

- [ ] **Step 7: Commit**

```bash
git add apps/customer-web/components/console apps/customer-web/components/docs apps/customer-web/app/console apps/customer-web/app/api/docs/reference apps/customer-web/app/docs/reference tests/e2e/organizations.spec.ts
git commit -m "refactor(console): fetch signed-in data through DPoP BFF (#123)"
```

---

### Task 6: Full verification, ADR follow-up, and closeout

**Files:**

- Modify: `docs/adr/0024-browser-proof-key-binding.md` (add a DPoP relay note)
- Test: full suites

**Interfaces:**

- Consumes: all earlier tasks.

- [ ] **Step 1: Update ADR**

Append to `docs/adr/0024-browser-proof-key-binding.md`:

```md
## DPoP relay (#123)

Bound tokens are presented with `Authorization: DPoP` and a `DPoP` header. The browser
signs each proof with the non-extractable key from this ADR; the BFF issues a short-lived
stateless HMAC challenge carrying the upstream descriptor and access-token hash, and the
browser returns the signed proof with the retried request. The BFF shape-checks the proof
but relies on AIHUB for signature and replay verification.
```

- [ ] **Step 2: Run all local gates**

Run: `npx tsc --noEmit && npm test && npm run lint && npm run check:aihub-contract`
Expected: type check clean, unit tests pass, lint has only the pre-existing advisory warning, contract check passes.

- [ ] **Step 3: Run full browser suite**

Run: `npm run test:e2e`
Expected: all specs pass, including the new DPoP assertions and Bearer fallback.

- [ ] **Step 4: Review and commit**

Run the `code-review` skill against `HEAD`, fix findings, then:

```bash
git add -A
git commit -m "feat(auth): complete DPoP proof relay (#123)"
```

- [ ] **Step 5: Push and monitor CI**

```bash
git push origin dev
```

Watch the run until every job is green. Do not close #123 until CI passes.
