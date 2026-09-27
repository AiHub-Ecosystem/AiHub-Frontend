# Sample request and Writing Scoring catalog

- Date: 2026-09-27
- Status: Approved in design review, awaiting spec review
- Related: ADR-0001, ADR-0003, ADR-0004, ADR-0008; aihub-be ADR-0017, `aihub-be/docs/integration-guide.md` §1a, §4, §6, §8

## Problem

After an owner or admin creates or rotates an API key, the Console shows the raw key once and nothing else. They have no concrete example of how to call AIHUB with it: which host, which headers, what `X-User-Identity` must carry, or what a success or failure looks like. The public catalog also still marks Writing "Chấm điểm" as `coming-soon`, although `POST /v1/ielts/writing/task1/grade` and `task2/grade` are live.

## Decisions

### Sample request

A **Sample request** (see `CONTEXT.md`) is shown inside `ApiKeyRevealDialog`, after both create and rotate. The UI label is "Gọi thử".

- **No in-app execution.** The Console never sends the raw key back to the BFF. The Sample request is a copyable `curl` command the holder runs from their own machine. This keeps the raw key on the one-way path ADR-0003 allows (BFF → browser) and needs no new ADR.
- **Host.** Always `https://api.aihubproduction.com`, the production Environment. Customer keys cannot allow `sandbox` (aihub-be `CustomerEnvironmentSchema`), and the sandbox Environment has its own database that does not contain Console Organizations (aihub-be ADR-0017). No `staging` host exists.
- **Key without `production`.** The create form always mints `production` keys, but rotation keeps an existing key's Environments, which may be `staging` for a key issued outside the Console. When `allowed_environments` does not include `production`, no command is shown; the block states that AIHUB has no public staging host yet.
- **One tab per scope** the key holds, Writing first:
  - `writing.grade` → `POST /v1/ielts/writing/task2/grade`, JSON body with a short sample `question`, `topic`, and `essay`. `Idempotency-Key` is a UUID generated once when the dialog opens, so rerunning the command replays the stored result for 24 hours instead of grading and charging again. The tab says so.
  - `speaking.grade` → `POST /v1/ielts/speaking/grading`, multipart, with `-F audio=@answer.wav` for the holder to point at their own file, plus `part=1`, `question_id=p1_hometown`, `prompt_text`, `test_type=Practice`. No public sample audio exists, so `grading-json` is not used.
  - A scope with no known endpoint gets no tab.
- **`X-User-Identity`** follows the roster's `identity_configured`:
  - `false` → `test-user-1`, labelled Declared User ID.
  - `true` or absent → placeholder `<user-assertion>`, with a note that the value must be a User Assertion signed by the Organization's identity provider, and that if AIHUB has disabled the configuration an End-User ID may be sent directly (ADR-0008). The roster cannot tell active from disabled, and the dialog does not query the configuration (ADR-0004).
- **Presentation per tab**, in this order:
  1. Method badge and full URL.
  2. Headers table (name, value, meaning): `X-API-Key` shows only `key_prefix…`; `X-User-Identity`; `Content-Type` (Writing); `Idempotency-Key` (Writing).
  3. Body table (field, sample value, required, meaning).
  4. Expected outcome: `200` with a trimmed response (`overall_band`, `criteria`, `summary` for Writing), and the common failures `401 UNAUTHORIZED`, `401 INVALID_USER_IDENTITY`, `403 FORBIDDEN`, `403 ENVIRONMENT_NOT_ALLOWED`, `429 RATE_LIMITED` / `QUOTA_EXCEEDED`.
  5. The `curl` command with the full raw key inline, and a "Sao chép lệnh" button. The command is for a bash-compatible shell, stated next to the button.
- **Usage warning**, one line: the command makes a real call counted against the Organization's usage.
- **Lifetime.** The Sample request is derived from the in-memory minted key and discarded with it when the dialog closes. Nothing is written to storage, logs, analytics, or URLs.

### Writing Scoring catalog

- `data/api-products.ts`: product `scoring` becomes `stable` with two endpoints, `grade-task1` (`POST /v1/ielts/writing/task1/grade`) and `grade-task2` (`POST /v1/ielts/writing/task2/grade`). `hasDemo` stays `false`.
- `data/api-reference.ts`: add `PRODUCT_DOCS["scoring"]` with an overview (Base URL `api.aihubproduction.com`, auth `X-API-Key` plus `X-User-Identity`, `Idempotency-Key` required), integration steps, and per-endpoint field tables, request examples, and response examples taken from aihub-be `src/contracts/writing/grading.ts`.
- **Headers per product.** The endpoint page's `curl()` helper takes the product's header list instead of hard-coding `Content-Type`, so Scoring examples carry `X-API-Key`, `X-User-Identity`, `Idempotency-Key`, and `Content-Type`.
- **Errors per product.** `COMMON_ERROR_RESPONSES` moves into each `PRODUCT_DOCS` entry. Exercise generation keeps its current list unchanged; Scoring lists the gateway errors from integration-guide §8 that apply to Writing.
- The Sample request's Writing body and the Scoring `grade-task2` request example share one source.
- **Writing reference examples.** Both endpoint pages show a complete response with the `{data, meta}` envelope and all four ordered `criteria`, matching `GradeResponseSchema` and the gateway success envelope. Task 1's required `image_url` uses an HTTP(S) placeholder with a note to replace it with a reachable chart image; `chart_type` uses one of the seven case-sensitive contract values. Task 2's shared request body includes required `question`, `topic`, and `essay`. The Task 2 quick-start example in the backend integration guide omits `topic`, so it must not be copied verbatim.
- **Public curl values.** Use shell variables for `X-API-Key` and `X-User-Identity`. Assign a UUID to a shell variable once per logical grading submission, then use it for `Idempotency-Key` so rerunning the same command with the same body keeps the key and does not start a second paid grade. State that a new submission needs a new UUID.
- **Writing errors.** Show all 19 gateway codes in integration-guide §8, including route-level `NOT_FOUND` and `IDENTITY_PROVIDER_UNAVAILABLE` only when a signed User Assertion requires JWKS retrieval. Preserve each code and the common `{error: {code, message, request_id, retryable, retry_after_ms?}}` shape; explain that retry decisions use `retryable` and Writing retries reuse the same `Idempotency-Key`.

## Out of scope (separate issues)

- Speaking endpoint links in the catalog 404 because Speaking has no `PRODUCT_DOCS` entry.
- `app/api/portal/specs/run-curl/route.ts` is an unauthenticated proxy with no caller.
- A free customer test Environment needs backend work (a staging host or sandbox access for customer keys).

## Testing

- Unit: the Sample request builder — tabs from scopes, host gating on `production`, identity value per `identity_configured`, header masking, and a command containing the full key and the pinned `Idempotency-Key`.
- E2E (`tests/e2e/organization-api-keys.spec.ts`): after create, the dialog shows the Sample request with the raw key in the command and only the prefix in the headers table; after close and reopen of another key, the previous command is gone; a staging-only key shows the note instead of a command.
- E2E: `/product/scoring` lists both endpoints and `/product/scoring/api/grade-task2` renders headers and the Scoring error list; exercise-generation pages are unchanged.
