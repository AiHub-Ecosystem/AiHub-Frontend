# Customer Web AIHUB compatibility: proof keys (0024)

- Minimum AIHUB SHA: `9cc57ed7cbfaea05b7acd447930a2e2735e34e47`
- Required revision or newer: Customer Web requires the AIHUB revision above because
  `POST /v1/auth/web-sessions/exchange` gains request field `client_proof_key` and response
  field `dpop_bound` (ADR-0024; contract 1.18.0).
- Backend cutoff metric for `enforce` rollback, per ADR-0176:
  `sum(increase(aihub_user_access_token_use_total{scheme="bearer",session="web"}[<owner-selected window>]))`.
- DPoP relay (#123) additionally requires AIHUB to accept `Authorization: DPoP` and the
  `DPoP` proof header on User-Access-JWT-guarded routes, with ES256/P-256 proof verification
  (ADR-0176). The same minimum SHA covers it.

## Rollout ordering (`verify` → `enforce`)

1. Deploy AIHUB at `off`, then move to `verify`. Existing Bearer clients keep
   working. Customer Web with #122/#123/#124 creates the proof key, sends
   `client_proof_key` on Web Session exchange, and uses DPoP whenever the
   exchange answers `dpop_bound: true`; unbound tokens and direct BFF requests
   keep Bearer. No Customer Web flag is needed: the mode is selected per
   response, and the client does not need to know AIHUB's configured mode.
2. Move to `enforce` only after the remaining Bearer Web Session traffic is
   zero: `sum(increase(aihub_user_access_token_use_total{scheme="bearer",session="web"}[<owner-selected window>]))`
   must be 0 over the owner-selected window, aggregated across app instances
   (ADR-0176). The owner sets the window and rollout date; this record does not
   invent either. A lost browser proof key now forces a fresh sign-in rather
   than re-registering the key against the existing Web Session.
3. Rollback: moving back to `off` or an older AIHUB image requires clients to
   switch from `Authorization: DPoP` to `Authorization: Bearer`. A bound token
   remains usable as Bearer on those images; doing this during `enforce`
   weakens the binding, so coordinate the switch with the owner.
