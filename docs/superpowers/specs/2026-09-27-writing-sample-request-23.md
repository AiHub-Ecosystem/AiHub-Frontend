# Writing Sample Request in the API-key reveal dialog

- Issue: [#23](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/23)
- Status: Ready for agent
- Related decisions: ADR-0003, ADR-0004, ADR-0008
- Broader design: [Sample request and Writing Scoring catalog](https://github.com/AiHub-Ecosystem/AiHub-Frontend/blob/feat/sample-request/docs/superpowers/specs/2026-09-27-sample-request-design.md)

## Problem Statement

After an Organization owner or admin creates or rotates an API key, the Console shows the raw key once but gives no concrete example of how to use it. The holder must work out the endpoint, headers, request body, and identity value themselves, which makes a first Writing grading request difficult and error-prone.

## Solution

Show a Writing Sample request in the one-time API-key reveal dialog whenever the newly issued key has the `writing.grade` scope. It presents the production endpoint, request details, expected outcomes, a usage warning, and a copyable `curl` command that the holder runs from their own machine. The Console does not execute the request or send the raw key back to the BFF.

This issue implements Writing only. Speaking and other scopes do not get Sample request tabs here.

## User Stories

1. As an Organization owner, I want to see a Writing Sample request after creating a key with `writing.grade`, so that I can make the first grading request without assembling it from separate documentation.
2. As an Organization admin, I want the same Sample request after rotating a key with `writing.grade`, so that the replacement key is as usable as a newly created key.
3. As an API-key holder, I want to see the HTTP method and complete endpoint URL, so that I know which API operation the command will call.
4. As an API-key holder, I want each required header and its purpose explained, so that I can understand authentication, identity, content type, and idempotency requirements.
5. As an API-key holder whose Organization has no active identity configuration, I want a Declared User ID example, so that I can run the request with the supported unsigned identity mode.
6. As an API-key holder whose Organization has an active or unknown identity configuration, I want a User Assertion placeholder and a clear note, so that I know the value must be signed by the Organization's identity provider.
7. As an API-key holder, I want to see a valid Task 2 request body, so that I can replace its sample content with my own essay while keeping the required fields.
8. As an API-key holder, I want the request body to match the Scoring Task 2 reference example, so that the Console and public API reference do not teach different contracts.
9. As an API-key holder, I want the command to use one idempotency key for the dialog's lifetime, so that rerunning the same sample replays its stored result instead of grading and charging again.
10. As an API-key holder, I want to copy the full command in one action, so that I can run it in a Bash-compatible shell without manually reconstructing headers or JSON.
11. As an API-key holder, I want to see the successful response shape and common failures, so that I can tell whether my request worked and diagnose typical setup errors.
12. As an Organization owner or admin, I want a clear warning that the sample makes a real request and counts against Organization usage, so that I understand its cost before running it.
13. As an API-key holder, I want a key without `production` to show why no command is available, so that I do not try the production endpoint with an incompatible key.
14. As an API-key holder, I want the headers table to show only the API-key prefix while the command contains the full key, so that the table remains safe to inspect while the command remains usable.
15. As an API-key holder, I want the Sample request and raw key to disappear when I close the dialog, so that a later reveal cannot accidentally reuse an earlier credential.
16. As an Organization owner or admin, I want the Console to keep the raw key on the one-time BFF-to-browser path, so that generating a sample does not create a second secret-bearing API call.
17. As an API-key holder, I want this issue to provide only the Writing request, so that unsupported Speaking request details are not presented as ready to run.

## Acceptance Criteria

- [ ] A key with `writing.grade` shows the Writing Sample request after both creation and rotation.
- [ ] The request is `POST https://api.aihubproduction.com/v1/ielts/writing/task2/grade` with JSON content type.
- [ ] The headers and body are documented, and the Task 2 body comes from the same source as the Scoring Task 2 reference example.
- [ ] The header table explains `X-API-Key` (prefix only), `X-User-Identity`, `Content-Type`, and `Idempotency-Key`.
- [ ] When roster `identity_configured` is `false`, `X-User-Identity` is `test-user-1`, labelled as a Declared User ID. This means there is no active identity configuration; the roster does not distinguish never-configured from AIHUB-disabled.
- [ ] When `identity_configured` is `true` or absent, the displayed value is `<user-assertion>` with a note that it must be signed by the Organization's identity provider and that an End-User ID may be sent directly if AIHUB has disabled the configuration. The Console does not fetch private identity configuration to resolve this state.
- [ ] `Idempotency-Key` is one UUID generated when the dialog opens and stays fixed for that dialog's lifetime. The UI says reruns replay the stored result for 24 hours; a new logical submission needs a new UUID.
- [ ] The expected `200` response shows `overall_band`, `criteria`, and `summary`; common failures are shown: `401 UNAUTHORIZED`, `401 INVALID_USER_IDENTITY`, `403 FORBIDDEN`, `403 ENVIRONMENT_NOT_ALLOWED`, `429 RATE_LIMITED`, and `429 QUOTA_EXCEEDED`.
- [ ] A one-line warning says the request is real and counts against the Organization's usage.
- [ ] If the key does not allow `production`, the UI shows no command and explains that AIHUB has no public staging host yet.
- [ ] A key without `writing.grade` does not show a Writing Sample request.
- [ ] The headers table shows only the API-key prefix. The copyable Bash-compatible command includes the full key inline using a shell variable.
- [ ] Copying the command does not trigger an API request from the Console.
- [ ] Closing the dialog discards the Sample request and its raw key from application memory. The raw key is not sent back to the BFF and is not written to storage, logs, analytics, or URLs.
- [ ] Unit and E2E coverage verifies the behavior below.

## Implementation Decisions

- Reuse the existing API-key reveal flow for both create and rotate; add the Writing Sample request to the reveal dialog for keys with `writing.grade`.
- Use the existing Organization Roster readiness value `identity_configured`. Do not fetch private identity configuration or add a backend/schema field. A false value means no active identity configuration, including both never-configured and AIHUB-disabled states.
- Keep the full key only in the one-time reveal state. The BFF returns it once for immediate display; the Sample request builder must not call the BFF or any AIHUB endpoint.
- Use `https://api.aihubproduction.com` only when the key allows `production`. A staging-only key has no runnable command because AIHUB has no public staging host.
- Build the Writing body from the same source used by the Scoring Task 2 reference example. Include the required `question`, `topic`, and `essay` fields.
- Generate the `Idempotency-Key` once when the reveal dialog opens. Reuse it for every copy or rerun while that dialog remains open.
- The command uses shell variables for the full API key and `X-User-Identity`; quote the identity placeholder so angle brackets are not interpreted as shell redirection. Keep the full raw key out of the headers table.
- Display the request method and URL, header table, body table, trimmed successful response, common failures, usage warning, and a copy button in the Writing tab.
- Do not implement Speaking, other scope tabs, an in-app request runner, or Writing catalog changes in this issue.

## Testing Decisions

- Good tests verify the behavior a key holder sees or copies: endpoint, headers, body, eligibility, identity value, idempotency key, command contents, and secret lifetime. E2E tests should not depend on private component state or CSS structure.
- Unit-test the Sample request builder for Writing scope selection, `production` gating, identity readiness mapping, API-key masking, body reuse, and a command containing the full key and the pinned idempotency key.
- Extend the existing API-key reveal E2E coverage through the Organization API-key page and mocked BFF responses. Verify the visible Sample request after create and rotate; staging-only keys show the note instead of a command; closing and opening another reveal removes the prior command; the headers show only the prefix; and the raw key does not appear in later requests, browser storage, or URLs.
- Prior art: the current API-key E2E suite already exercises create, rotation, one-time reveal, and close behavior; existing API-key scope unit tests cover scope-level decisions. Extend those seams rather than adding a separate test-only UI.

## Out of Scope

- Speaking Sample request, multipart upload, or audio-file guidance; handle in a separate issue.
- Sample requests for scopes other than `writing.grade`.
- A Console-side “try request” or any in-app API execution.
- A public staging host, customer sandbox access, or changes to backend key/environment contracts.
- Changes to Identity Configuration privacy, Organization Roster shape, or API-key create/rotate semantics.
- The broader Writing Scoring catalog and API-reference work covered by the linked design document.

## Further Notes

- Respect ADR-0003's one-way handling of newly issued raw API keys and ADR-0004/ADR-0008's Identity Readiness semantics.
- The broader design document may describe future scope tabs; this issue and its acceptance criteria cover Writing only.
