# tRPC at the browser-to-Customer Web BFF seam

- Issue: [#100](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/100)
- Date: 2026-10-20
- Scope: one seam, one operation — Organization creation, `POST /api/organizations`
- Conclusion: **more evidence**

## What was run

A tRPC prototype for Organization creation, served beside the current route, with the
same BFF building blocks (`lib/auth-session`, `lib/organizations`) and the same fake
AIHUB upstream. Every case ran over real HTTP as a browser request, once against the
current route and once against the prototype, in one matrix.

| Artifact                                    | What it is                                                       |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `spikes/trpc-bff/router.ts`                 | The tRPC router: one `organizations.create` mutation             |
| `spikes/trpc-bff/handler.ts`                | The fetch adapter, its error formatter and its status hook       |
| `tests/integration/trpc-bff-seam.test.ts`   | The matrix: 29 cases, both transports                            |
| `tests/integration/support/seam-harness.ts` | The harness: the fake upstream, the BFF server, the browser side |

The fake upstream is the E2E mock (`tests/e2e/mock-aihub-server.mjs`), so every upstream
answer in this spike was validated against the pinned AIHUB OpenAPI contract
([ADR-0022](docs/adr/0022-gate-aihub-integration-on-pinned-openapi.md)). No request
reached a real AIHUB, no caller was switched, nothing was deployed, and no route was
migrated. `spikes/` is not under `app/`, so the deployed Customer Web cannot reach it.

The matrix is an integration test rather than a unit test: it crosses the HTTP boundary
on purpose, because the thing under evaluation _is_ the HTTP answer — its status, its
headers and its body. A stubbed `fetch` would have measured the wrong thing.

Reproduce: `npm test -- tests/integration/trpc-bff-seam.test.ts`

## Behaviour comparison

Observed, not inferred. "Same" means the browser sees the same status, the same cookie
and the same upstream request.

| Behaviour                        | Current route                     | tRPC prototype                    | Same?  |
| -------------------------------- | --------------------------------- | --------------------------------- | ------ |
| Cross-origin request             | `403`, empty body                 | `403`, JSON error envelope        | status |
| Invalid Organization name        | `400`, `INVALID_NAME`             | `400`, `INVALID_NAME`             | status |
| Malformed body                   | `400`, `INVALID_NAME`             | `400`, tRPC's own parse error     | status |
| Invalid idempotency key          | `400`, `IDEMPOTENCY_KEY_REQUIRED` | `400`, `IDEMPOTENCY_KEY_REQUIRED` | status |
| Upstream call on any rejection   | none                              | none                              | yes    |
| Missing Web Session              | `401`, session cookie cleared     | `401`, session cookie cleared     | yes    |
| Rejected Web Session             | `401`, session cookie cleared     | `401`, session cookie cleared     | yes    |
| Expired Web Session              | `401`, session cookie cleared     | `401`, session cookie cleared     | yes    |
| Successful creation              | `201`                             | `201`                             | yes    |
| Name sent upstream               | trimmed                           | trimmed                           | yes    |
| Idempotency key sent upstream    | unchanged                         | unchanged                         | yes    |
| Organization Creation Limit      | `409`                             | `409`                             | yes    |
| Upstream idempotency conflict    | `409`                             | `409`                             | yes    |
| Upstream outage answer           | `503`                             | `503`                             | yes    |
| Unreachable upstream             | `503`                             | `503`                             | yes    |
| Retry with the same name and key | one Organization                  | one Organization                  | yes    |

Every status the route produces survives, including the `201` and the cookie clearing.
What does not survive is the body the browser reads:

|                                        | Current route                       | tRPC prototype                                                                                                           |
| -------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Success body                           | AIHUB's body, verbatim              | `{"result":{"data": <AIHUB's body>}}`                                                                                    |
| Error body                             | `{"error":{"code":"INVALID_NAME"}}` | `{"error":{"message":…,"code":-32600,"data":{"code":"BAD_REQUEST","httpStatus":400,"path":…,"bffCode":"INVALID_NAME"}}}` |
| Where the browser reads the BFF's code | `error.code`                        | `error.data.bffCode`                                                                                                     |
| URL                                    | `POST /api/organizations`           | `POST /trpc/organizations.create`                                                                                        |

The browser client and the E2E specs for this route change with the body, not with the
status.

`bffCode` is a new name. The BFF's own error codes have no name in `CONTEXT.md` today —
the current route carries them in `error.code`, and tRPC takes that field for its own
error key. If the maintainer adopts tRPC, `bffCode` is the term `CONTEXT.md` would need
to carry, and the browser would read `error.data.bffCode`.

## HTTP-status limitations

1. **A success status is not a property of the procedure.** tRPC answers `200` for a
   successful call. The `201` had to come from `responseMeta`, a hook on the _handler_,
   which sees the procedure path and the errors but not the procedure's own result. One
   router therefore picks its success status per path, in the transport layer, not in the
   procedure. `spikes/trpc-bff/handler.ts` shows the branch.
2. **A batch collapses to one response status.** A batched call whose procedures disagree
   answers `207`, and the client must read each call's own `httpStatus` out of the body.
   The current route always has exactly one status per request. tRPC's default browser
   link (`httpBatchLink`) batches, so keeping one status per request means using
   `httpLink` deliberately. The matrix proves the collapse: a batch of one rejected and
   one accepted creation answers `207`.
3. **The error _key_ is tRPC's, not the BFF's.** tRPC labels an error with one of its own
   keys, and the BFF's own code needs a second field to travel beside it. The prototype
   carries it in `data.bffCode`.
4. **The tRPC client ignores the HTTP status.** `httpRequest` reads `await res.json()`
   without looking at `res.ok`, so an error body that is not a tRPC error envelope is
   unreadable: the current route's empty-body `403` would leave the client with a JSON
   parse error, and the current route's `{"error":{"code":"INVALID_NAME"}}` body is not a
   tRPC error response either (`error.code` must be a number and `error.message` a
   string), so the client would report "Unknown error" and drop the BFF's code. tRPC
   answers `403` with a body, and the domain code has to travel in `data`.

The **status** itself is not limited: tRPC reads the answer's status from the error
shape's `httpStatus`, and the prototype sets that field from the upstream's status, so an
upstream status outside tRPC's key table would still answer with its own status, under a
generic key. What the table limits is the label, not the code.

## What this says about adoption

Nothing here blocks tRPC at this seam. Every status, cookie and upstream request the
route makes is reproducible, and the prototype needed four small hooks to do it: a
`responseMeta` for the success status, an `errorFormatter` for the BFF's code and the
status, a `TRPCError` per outcome, and `resHeaders` for the session cookie.

What the spike cannot price is the reason to adopt it. The payoff of tRPC is end-to-end
types, and that payoff grows with the number of BFF routes; this spike measured one
mutation and no query. The cost also grows with the surface: each route's browser client
and E2E specs change, and the BFF stops being a pass-through of the pinned AIHUB
contract, because the browser no longer sees AIHUB's body directly.

**Recommendation: do not migrate this route on the strength of this spike.** If the
maintainer wants tRPC across the BFF, that is a separate decision with its own issue,
and the evidence it needs is:

- one read path (the Organization Roster) measured the same way, to see what a query
  costs at the seam;
- the number of BFF routes, browser clients and E2E specs a migration would touch;
- whether the browser keeps seeing the AIHUB contract, or a second contract of its own.

### Assumptions

- `[ASSUMPTION]` The tRPC payoff is per route, not per seam. — Basis: the typed client
  only pays where a browser call would otherwise be hand-written. — Risk if incorrect:
  low.
- `[ASSUMPTION]` The BFF should keep passing the pinned AIHUB contract through to the
  browser. — Basis: ADR-0022 pins that contract so both sides move together, and every
  current route forwards AIHUB's body unchanged. — Risk if incorrect: medium; the
  recommendation would change.
- `[ASSUMPTION]` The browser's client and the E2E specs are the whole migration cost on
  the browser side. — Basis: the spike measured the seam only. — Risk if incorrect: low.

## Verification

- `npm test` — 28 files, 355 tests, all passing, including the 29 spike cases.
- `npx tsc --noEmit --incremental false` — clean.
- `npx eslint .` — clean.
- `npm run build` — the built route list holds no `/trpc` route, because nothing under
  `app/` imports `spikes/`.
- `node scripts/prod-dependencies.mjs --list` — the production tree holds no `@trpc`
  package: both are dev dependencies, and the Dockerfile installs the runtime tree with
  `npm ci --omit=dev`.
- `npm run check:aihub-contract` — the pinned contract still matches its source commit.

## Why this is one change

The spike is one artifact: the prototype, the evidence and the record. Splitting the
record from the prototype would leave a document that no reader can re-run, and the
record is the deliverable the issue asks for. The change is larger than the 400-line
guideline in `02TechandCodeRule.md` §C.17 for that reason.

## Notes for the decision

- The production files this change touches are two, and neither changes behaviour: the
  idempotency-key rule now lives once in `lib/organizations.ts` (`UUID_V4_PATTERN`),
  read by the route, the Console form and the prototype. The pattern is unchanged.
- The E2E mock gained two changes: `AIHUB_MOCK_PORT` overrides its fixed port `3101`, so
  this spike can run beside an E2E run instead of fighting it for the port, and the mock
  now reports the port it bound, so the spike needs no port race. It also gained a
  `createUnavailable` mode, so the matrix can answer with an upstream outage.
- A tRPC error body carries the stack trace outside production (`isDev`), so file paths
  would reach the browser in a staging environment.
- tRPC's typed input needs a validator, and this repository has no direct schema
  dependency, so the prototype validates the name with the same
  `validatedOrganizationName` helper the route uses. The typed-input benefit is
  therefore smaller here than it would be with a schema library.
