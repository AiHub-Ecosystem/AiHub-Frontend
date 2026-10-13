# Let demo visitors choose an environment and copy safe requests

- Status: Accepted
- Date: 2026-10-13
- Related: [Issue #68](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/68), [follow-up issue #69](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/69), [FE PR #67](https://github.com/AiHub-Ecosystem/AiHub-Frontend/pull/67), [BE PR #602](https://github.com/AiHub-Ecosystem/aihub-be/pull/602), backend ADR-0095
- Amends: [ADR-0011](0011-console-creates-production-keys-only.md) for Console key creation; [ADR-0017](0017-sandbox-backed-scoring-demo.md) for demo environment choice and Sandbox allowance

## Decision

This records the accepted design implemented by the follow-up to issue #68. The decision describes the intended behavior; it becomes available to visitors when the changes are merged and deployed.

The Writing and Speaking demos and the Console key-creation form offer an explicit `Sandbox` or `Production` environment choice, defaulting to Sandbox. The selected environment must match the key's backend-authorized environment. A mismatch is an error; the BFF never silently switches a request to Production. It selects only the fixed HTTPS host for the validated environment: `https://sandbox.aihubproduction.com` or `https://api.aihubproduction.com`.

Demo visitors may enter a key or skip key setup. Skip, missing key, or failed validation keeps the demo in fixed, read-only Mock mode. Mock submit renders the fixture for that Writing Task 1/2 or Speaking Part 1/2/3 and makes no catalog, validation, grading, or AI-service request. A key that validates for the selected environment and the current page's scope unlocks editable answers and Live grading. Validation does not reserve quota or authorize later calls. Live grading authenticates and checks current policy again. The Organization's key, quota, and identity policy govern the call whether or not the visitor signed in to AIHUB; the demo's temporary random UUID is the `X-User-Identity`, never the AIHUB username. An Organization with active Identity Configuration is refused until the demo can receive an assertion signed by that Organization.

The key-validation response may show a Sandbox allowance snapshot, separately from key validity and grading admission. A key may be valid while grading is blocked by Organization allowance, the shared Sandbox ceiling, or an admission control. The displayed remaining count is informational; each grading request rechecks availability.

Before the first Production grade in a demo visit, the visitor must confirm that the request can incur real charges. Changing the key or environment clears that acknowledgement. This confirmation explains the cost; it is not a spend ceiling or a substitute for backend authorization and quota enforcement.

The demo keeps the AIHUB shell and visual tokens, while using the prototype's Overview plus five-step structure. Every step presents the relevant Request, Response, and Headers; the integrated console supports tabs and copy. Mock responses are marked as fixed examples, while Live responses show normalized AIHUB results. The Console key form offers Sandbox and Production; Sandbox creation is limited to the Organization's permitted Writing and Speaking scopes, and Production is labelled as billable.

The demo key and its validation state live only in page memory, shared while navigating between the two demo skills. They are not written to cookies or web storage and are excluded from logs, analytics, traces, and copied artifacts. Leaving the demo, logout in any tab, or restoring a cached page clears the key and Production acknowledgement. Cross-tab logout signaling carries no secret. The demo identity is one random UUID per visit and is shared across both skills. Key, environment, scope, and request generation are bound together so a delayed validation response cannot unlock a changed selection. A live grade locks key and environment changes across both skills until its request finishes. Requests use the selected host from a fixed allowlist and reject redirects.

Copy actions provide cURL/Bash, PowerShell, importable Postman JSON, and an agent prompt. They use the selected environment's host and an environment variable or placeholder for the key; they never copy the supplied secret. User-authored answers and prompts are serialized and shell-quoted for shell and Postman formats, not concatenated into executable syntax. The agent prompt omits the visitor's answer, uses a body placeholder, and asks for a text example only; it does not ask the agent to read local secrets, run tools, send requests, or retry billable work.

Writing retries reuse one stable idempotency key for the same logical submission; a new submission receives a new key. A completed successful replay does not consume another Sandbox dispatch. Speaking has no idempotent replay or automatic retry; an explicit retry is a new attempt and may consume another dispatch. A timeout or cancellation does not prove that downstream dispatch did not happen and does not refund a consumed Sandbox allowance.

## Consequences

The existing Sandbox-only demo remains the deployed behavior until this decision is deployed. Its current Sandbox allowance remains governed by the existing policy. The approved extension changes the default Sandbox allowance to five dispatches per Organization per UTC month, shared across keys, clients, and both skills, with a shared Sandbox ceiling of 500. The new default starts in the UTC month after deployment; the in-force allowance and usage for the deployment month are preserved. Per-Organization monthly overrides replace the default for that month and do not reset usage. See backend ADR-0095 for admission and persistence rules.

The Production confirmation reduces accidental paid calls but cannot guarantee a maximum monetary spend. Production remains subject to the existing key, quota, and rate policies; no USD-budget feature is part of this decision. Memory-only handling limits persistence but cannot protect a key from same-origin script compromise or browser extensions. Copying a request intentionally does not embed a secret, so users set the key in their shell or Postman environment first.

## Acceptance boundaries

- A revoked, expired, suspended, wrong-environment, wrong-scope, or newly identity-configured Organization cannot grade using an earlier validation result.
- Changing the key or environment while validation is in flight cannot apply a stale response; changing either also requires a new Production confirmation.
- Changing the key or environment from either skill is blocked while a live grade is in flight.
- Mock submit causes no network call to a catalog or grading service.
- Two simultaneous grades with one Sandbox dispatch remaining admit at most one dispatch; unavailable or corrupt Sandbox policy state blocks dispatch.
- Logout in another tab and Back/Forward cache restoration clear in-memory secrets and acknowledgements.
- Shell and Postman outputs handle shell metacharacters in editable answers without changing command structure; the agent prompt contains no visitor answer or API key value.
