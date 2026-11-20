# Browser proof keys bind Web Session access tokens

- Status: Accepted
- Date: 2026-11-20
- Issue: [#122](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/122), rollout follow-up [#124](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/124)
- Related: [ADR-0176](../aihub-be/docs/adr/0176-dpop-binds-web-session-jwts.md)

## Context

ADR-0176 makes AIHUB accept DPoP proofs for Web Session JWTs while in `verify`, and require them in `enforce`. The Customer Web must therefore hold a per-browser proof key and supply it to AIHUB before `enforce` cuts off Bearer use. The key is non-extractable because DPoP is only sender-constraining; an extractable key would be a copy, not a barrier.

## Decision

- Customer Web generates a non-extractable P-256 key in IndexedDB (`aihub-web-proof-key.proof-keys`), scoped by the signed-in account. The durable store is the public JWK `{kty, crv, x, y}` plus a re-imported non-extractable private key used for signing.
- The browser sends the public JWK to the BFF as an `aihub_proof_key` cookie on every `/app` request. The BFF reads it with `clientProofKeyFromHeaders`, relays it as `client_proof_key` on every exchange, and treats a missing/invalid field as unbound.
- If an older AIHUB image rejects the new exchange request member with `400`, the BFF retries the exchange unbound; the token stays usable as Bearer.
- Sign-in flows install the cookie best-effort: the login form installs the account-scoped key before native submission; the session activity installs it from the account scope cookie when sign-in happened without a form. The verification sign-in route redirects with a Web Session-scoped scope cookie; if that cookie is absent, session activity falls back to `aihub:current-session`. The proof cookie is a browser-session cookie (no `Max-Age`); a missing cookie later treats the token as unbound, per ADR-0176.
- Logout deletes the proof key and scope cookies.

## Alternatives

- **BFF in-memory map keyed by Web Session.** Smaller first diff, but not visible to other instances and must re-register after restarts; loses the "browser supplies JWK to BFF" model in the issue.
- **Authorization header on every BFF request.** More moving parts; cookie on `/app` requests is simpler and equally scoped by `Path=/app` + `SameSite=Strict`.
- **BFF sets HttpOnly cookie.** Cleaner browser surface, but the browser must tell the BFF the JWK first, so JS-set cookie is required anyway until a separate registration endpoint exists.

## Consequences

- Every exchange may relay `client_proof_key`; older AIHUB images that reject unknown request fields need the unbound retry.
- The cookie is only public JWK data; same-site and path scope keep it near the token.
- Rollback to an older Customer Web image leaves bound tokens usable as Bearer and new unbound tokens fine, per ADR-0176.
- The `enforce` → `off`/older-image downgrade caveat from ADR-0176 still applies; rollout timing is owned by #124, whose backend metric is `aihub_user_access_token_use_total{scheme="bearer",session="web"}`.

## DPoP relay (#123)

Bound tokens are presented with `Authorization: DPoP` and a `DPoP` header. The browser
signs each proof with the non-extractable key from this ADR; the BFF issues a short-lived
stateless HMAC challenge carrying the upstream descriptor and access-token hash, and the
browser returns the signed proof with the retried request. The BFF shape-checks the proof
but relies on AIHUB for signature and replay verification. Console data reads are
client-fetched so the browser is present for signing; BFF routes pass the 428 challenge
through with its headers intact.

## Notes

- The backend cutoff metric is `sum(increase(aihub_user_access_token_use_total{scheme="bearer",session="web"}[window]))`; keep the release/rollout window from #124.
