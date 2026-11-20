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
- Rollout ordering and flag decision are owned by [#124](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/124).
