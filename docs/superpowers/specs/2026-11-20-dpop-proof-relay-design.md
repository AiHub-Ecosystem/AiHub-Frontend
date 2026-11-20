# Design: relay browser-signed DPoP proofs through the Customer Web BFF (#123)

- Date: 2026-11-20
- Issue: https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/123
- Depends on: #122 (browser proof key + `dpop_bound` binding, shipped and deployed)

## Context

AIHUB ADR-0176 accepts DPoP proofs for Web Session access tokens in `verify` and
requires them in `enforce`. #122 gave the browser a durable, non-extractable P-256 key and
made every BFF request carry its public JWK, so the BFF can bind and cache `dpop_bound`.
That slice does not sign or send proofs: bound tokens still travel as Bearer.

The hard constraint is that the private key stays in the browser, while the access token
and the upstream request descriptor live in the BFF. A proof binds `htm`, `htu`, and
`ath` (hash of the exact token), so the browser cannot pre-sign a reusable proof: it needs
a fresh descriptor per call, `iat` is inside a 60-second skew, and server-rendered reads
give the browser no chance to sign at all.

## Goals

- Every BFF-routed AIHUB call made with a `dpop_bound: true` token carries a valid,
  single-use DPoP proof in the upstream request.
- Unbound tokens keep Bearer behaviour unchanged; `verify` mode has no regression.
- A 401 token refresh produces a new proof bound to the refreshed token before the retry.
- `token_type` remains `Bearer`; only `dpop_bound` selects the scheme.

## Non-goals

- Key generation, storage, loss recovery, and the `verify` → `enforce` rollout flag
  (#122/#124).
- Moving the private key into the BFF or exporting it. ADR-0176 forbids this.
- New environment variables. HMAC material is derived from the existing
  `AIHUB_WEB_SESSION_CLIENT_SECRET`.

## Architecture

The BFF never holds the private key. It issues a short-lived, stateless challenge that
the browser signs; the browser returns the challenge and proof together with the retried
BFF request. No server-side challenge store is needed, so any app instance can verify it.

```text
Browser                          Customer Web BFF                    AIHUB
  |-- BFF request (no proof) ------>|                                  |
  |<-- 428 + challenge ------------|                                  |
  |  sign proof with IndexedDB key |                                  |
  |-- retry + challenge + proof -->|                                  |
  |                                |-- verify challenge + proof       |
  |                                |-- Authorization: DPoP + DPoP --->|
  |<-- upstream result ------------|<-- result ------------------------|
```

### Challenge format

`X-AIHUB-DPOP-CHALLENGE` response header and `X-DPoP-Challenge` request header carry a
base64url JSON payload plus a base64url HMAC-SHA256 signature, separated by `.`:

```json
{
  "v": 1,
  "s": "<base64url SHA-256 of the Web Session token>",
  "m": "POST",
  "u": "http://host/v1/organizations",
  "a": "<base64url SHA-256 of the exact access token>",
  "e": 1795132800,
  "n": "<random nonce>"
}
```

The HMAC key is `SHA-256("aihub-dpop-challenge:" + AIHUB_WEB_SESSION_CLIENT_SECRET)`.
Verification requires: valid signature, `v === 1`, `e` in the future within 60 seconds,
`s` equal to the hash of the request's Web Session token, and `m`/`u`/`a` equal to the
descriptor of the call about to be made. Challenges are single-purpose but not stored;
the backend's `jti` replay guard covers proof reuse.

### Proof signing (client)

`lib/dpop-proof.ts` loads the non-extractable private key from the same IndexedDB record
created in #122 and signs an ES256 JWT with:

- protected header: `typ: dpop+jwt`, `alg: ES256`, `jwk` (public JWK with only `kty`, `crv`, `x`, `y`);
- payload: `htm`, `htu`, `ath`, `jti` (random UUID), `iat` (seconds).

`lib/dpop-fetch.ts` wraps `fetch` for BFF calls: on 428 it reads the challenge header,
calls `signDpopProof` with the descriptor, and retries once with `X-DPoP-Challenge` and
`X-DPoP-Proof`. It allows one further challenge after an upstream 401 refresh.

### BFF fetch path

`authenticatedAihubFetch` gains challenge/proof handling:

- bound token, no/invalid challenge → 428 with a fresh challenge, no upstream call;
- bound token, valid challenge + proof → verify proof claims against the challenge, then
  send `Authorization: DPoP <token>` and `DPoP: <proof>`;
- unbound token → Bearer exactly as today, including the single 401 refresh retry;
- bound token + upstream 401 → delete cached session, exchange a new token, return 428
  with a challenge carrying the new `ath`; the client wrapper signs and retries the BFF
  request. The upstream call was rejected, so replaying the request has no second effect.

`htu` is built from the trusted upstream origin plus pathname only (no query/fragment),
matching ADR-0176. `token_type` is ignored for scheme selection.

### Console client-fetch conversion

Server components currently read Console data via internal BFF fetches that carry only
the session cookie; the browser never sees them and cannot sign. Convert those reads to
client components using `dpopFetch`:

- `lib/organization-server.ts` consumers (roster and API-key inventory);
- `app/docs/reference/route.ts`.

`components/site-chrome.tsx` only triggers Web Session exchange, not an AIHUB
User-Access-JWT call, so it stays unchanged. Public/auth routes that do not use
`authenticatedAihubFetch` are unaffected.

### Errors

- `428 DPOP_PROOF_REQUIRED`: bound token needs a challenge/proof; includes the challenge header.
- `400 DPOP_PROOF_INVALID`: proof missing, malformed, or claims do not match the challenge.
- Real auth failures keep their existing `401 AUTH_REQUIRED` + cookie clearing.

## Testing

- Unit: challenge sign/verify (signature, expiry, session/method/url/ath binding); BFF
  bound/no-proof → 428, bound/valid proof → DPoP upstream headers and correct `ath`,
  unbound → Bearer, 401 → fresh challenge, invalid proof → 400.
- Mock AIHUB: verify the DPoP proof for real (ES256 signature, `typ/alg/jwk`, `htm/htu/ath/jti/iat`,
  replayed `jti`) and record the observed scheme.
- Browser/e2e: key persistence from #122 plus Console action with a valid DPoP proof;
  unbound Bearer fallback; 401 refresh producing a new proof for the new token.

## Risks

- Client-fetch conversion changes loading states for Console pages; keep existing
  empty/error copy so behaviour regressions are visible in e2e.
- Stateless challenges are replayable within 60 seconds, but a replay needs both the
  same browser session and the browser's signed proof; backend `jti` dedupe is the final guard.
- If AIHUB is in `off`/older image, exchange returns no `dpop_bound`, so no challenge is issued.
