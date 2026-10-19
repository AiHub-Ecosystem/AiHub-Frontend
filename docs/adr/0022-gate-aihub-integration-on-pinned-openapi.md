# Gate AIHUB integration changes on a pinned OpenAPI contract

- Status: Accepted
- Date: 2026-10-19
- Issue: [aihub-be #461](https://github.com/AiHub-Ecosystem/aihub-be/issues/461)

## Decision

Customer Web pins the generated AIHUB `openapi.json` to an exact AIHUB commit. Its CI validates every response emitted by the E2E mock for real AIHUB routes used by the BFF and browser demos, including status and body for success, error, and `204` responses. Exclude `__test__` control routes and synthetic `503 LOCAL_MOCK_OUTAGE` responses from schema validation while retaining outage tests.

AIHUB CI checks a candidate OpenAPI contract against the current Customer Web `dev` consumer and any linked Customer Web PR needed for the change. Each repository's deployment gate must reject a change that breaks the other deployed consumer. Keep independently deployed versions compatible through expand-and-contract rollouts. Link the Customer Web issue or PR from an AIHUB PR summary when frontend work is required.

OpenAPI is the source of truth for the `expires_in` limit of 900 seconds and the Speaking upload limit of 25 MiB (26,214,400 bytes). AIHUB must describe the upload limit explicitly; the audio asset `byte_size` limit does not describe the upload request limit. Customer Web reads both values from its pinned contract.

Document how to trace AIHUB routes to BFF callers and mocks using repository search and stable code entry points, rather than maintaining an exhaustive endpoint/file list.

## Acceptance checks

- A regression test supplies a deliberately schema-invalid mock response and fails; retain evidence of one intentionally red run proving the CI gate blocks it.
- Customer Web CI validates all real AIHUB mock routes against the pinned contract. `__test__` routes and injected `LOCAL_MOCK_OUTAGE` failures remain outside schema validation.
- AIHUB CI checks candidate contracts against Customer Web `dev` and the linked frontend change when required; both deployment paths are gated on compatibility.
- The contract explicitly describes the Speaking upload request limit, and Customer Web derives it and the 900-second expiry limit from the pinned OpenAPI.
- Route discovery guidance uses searchable code entry points; AIHUB PR summaries link frontend work when needed.
