# Design: recover from a lost DPoP proof key and document the `verify` → `enforce` rollout (#124)

- Date: 2026-11-20
- Issue: https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/124
- Depends on: #122 (browser proof key + `dpop_bound` binding) and #123 (DPoP proof relay), both shipped and deployed

## Context

AIHUB ADR-0176 binds a Web Session's User Access JWT to the RFC 7638 thumbprint of the first
`client_proof_key` it sees (compare-and-set). Later exchanges must use the same key; a key
change requires a new sign-in and there is no re-registration path. Today the Customer Web
caches `dpop_bound` next to the access token but does not remember which key was bound. If a
browser loses its IndexedDB key (profile reset, storage clear) it generates a new one, and
the BFF keeps relaying proofs from a key AIHUB no longer accepts. In `verify` mode this can
look like a working Bearer session until `enforce` locks it out.

## Goals

- Detect that the browser's current proof key differs from the key bound to the cached Web
  Session, before making any upstream AIHUB call.
- Clear the cached bound-token state and force a fresh sign-in. Never send a second exchange
  with a different key for the same Web Session.
- Keep unbound Bearer sessions and direct BFF/test requests unchanged.
- Document the coordinated `verify` → `enforce` switch and the Bearer-counter cutoff metric.

## Non-goals

- Re-registering a key against an existing Web Session (ADR-0176 forbids it; new sign-in only).
- Moving the private key into the BFF or exporting it.
- A Customer Web env flag for AIHUB's mode. The client already follows `dpop_bound` from each
  exchange response and is agnostic to `off`/`verify`/`enforce`; coordination is operational.

## Architecture

The bound thumbprint is computed in the BFF with Node's `crypto` and stored beside the access
token. The browser keeps sending its full public JWK on every request; no new client state is
required.

```text
Browser                    Customer Web BFF                    AIHUB
  |-- BFF request (JWK K2) --->|
  |                            | compare jkt(K2) vs cached jkt(K1)
  |                            | mismatch -> drop cache, 401 + clear session
  |<-- /login?error=session ---|   (no exchange, no re-registration)
  |-- fresh sign-in ---------->|-- exchange with K2 ----------->|
  |                            |<-- dpop_bound: true -----------|
  |-- Console works ---------->|-- DPoP proof signed by K2 ---->|
```

### Thumbprint

RFC 7638 over the closed P-256 JWK: `sha256(JSON.stringify({crv,kty,x,y}))` encoded
base64url without padding. This is byte-identical to AIHUB's `jsonWebKeyThumbprint`
(ADR-0176). Because the public-key schema is closed (`kty`, `crv`, `x`, `y` only), the
thumbprint is a stable identity for the key.

### Recovery path

`WebSession` gains `boundThumbprint: string | null`, set from the `client_proof_key` used at
exchange (null when unbound). In `getCurrentWebSession`:

- cached session is `dpopBound` and the request carries a proof key whose thumbprint differs
  from `boundThumbprint` → delete the cache entry and return `null`. Callers already redirect
  page requests to `/login?error=session` and answer BFF requests with `AUTH_REQUIRED` plus
  an expired web-session cookie.
- The existing rule that re-exchanges an unbound cached session when a key first appears is
  preserved.
- A missing cookie (direct BFF/test requests) is not a mismatch; those stay on Bearer.

Because the check runs at the start of every `getCurrentWebSession` call, no exchange or
upstream request happens with the wrong key. The 401 token-refresh path in
`authenticatedAihubFetch` is for token rotation and is left unchanged.

### Rollout documentation

`docs/releases/0024-customer-web-aihub-1.18.0.md` replaces the placeholder with:

1. Deploy AIHUB at `off`, then `verify` — existing Bearer clients keep working; Customer Web
   with #122/#123/#124 creates the key, sends `client_proof_key`, and uses DPoP whenever the
   exchange answers `dpop_bound: true`.
2. Move to `enforce` only when
   `sum(increase(aihub_user_access_token_use_total{scheme="bearer",session="web"}[<owner-selected window>]))`
   is zero over the chosen window, aggregated across app instances (ADR-0176). The owner sets
   the window and date; no number is invented here.
3. Rollback note: switching back to `off`/older images needs Bearer; a bound token is usable
   as Bearer on those images.

## Testing

- Unit: with a cached bound session for key K1, `getCurrentWebSession` with key K2 returns
  `null`, deletes the cache entry, and makes no exchange HTTP call; missing cookie keeps the
  cached session; the unbound→bound re-exchange rule still applies.
- Browser: sign in (binds K1), delete the IndexedDB proof key and swap the cookie for K2,
  navigate to Console → redirected to login with no second exchange for the old Web Session,
  sign in again → K2 bound, Console loads. Extend the mock server with a probe exposing the
  thumbprint of the key used per exchange.
- Existing unit and browser suites stay green.

## Acceptance criteria

- [ ] Deleting the proof key forces re-sign-in and a new sign-in restores Console access.
- [ ] No API call re-registers a key against an existing Web Session.
- [ ] Rollout doc states the `verify` → `enforce` order and the cutoff metric.
- [ ] Unit and browser tests pass.
