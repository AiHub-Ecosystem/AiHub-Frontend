# Chấm điểm demo — `/demo/scoring`

- Date: 2026-10-11
- Status: Approved in design review, awaiting spec review.
- Related: `docs/superpowers/specs/2026-09-27-sample-request-design.md` (§ Writing Scoring catalog), `app/demo/speaking/speaking-workbench.tsx`, `lib/speaking-gateway.ts`

## Problem

`data/api-products.ts` describes product `scoring` (`Chấm điểm`) with two live endpoints — `POST /v1/ielts/writing/task1/grade` and `task2/grade` — and already carries `status: "stable"`. `/product/scoring` therefore shows "Stable" and links through today.

`/demo` shows the same product as "Coming Soon" with no "Mở demo" link. The gate is not the status: `app/demo/demo-catalog.tsx` computes `ready = product.hasDemo && product.demoReady`, and `data/api-products.ts:57-58` still has both flags `false`. The Speaking product became clickable the same way — by building its demo, not by editing the catalog.

Writing has no demo surface at all: no BFF route, no gateway, no typed response. Everything else the demo needs is already in the repo.

## Decisions

### Demo surface

Flip `hasDemo` and `demoReady` to `true` at `data/api-products.ts:57-58`. Nothing else in the catalog changes — `/demo` derives the badge and the link from those two booleans alone.

The demo page is public, like every other `/demo/*` route. No `requirePageWebSession`: the gate lives in the gateway (server-only env keys, pinned host, same-origin check, no cookies), not in the page.

### One BFF route, not two

Speaking needs two routes because its two upstream operations have different request shapes (multipart and JSON). Writing's two operations are both plain JSON, differing only in path and field set. One route, `POST /api/demo/scoring/grade`, carries the task in the body.

### Gateway split

`lib/speaking-gateway.ts` mixes two concerns: sandbox transport (host pinning, assertion minting, same-origin, upstream status mapping) and Speaking-specific validation (audio fields, parts, extensions). Writing needs the first and not the second.

Extract the transport into `lib/sandbox-gateway.ts`. Both gateways import it; neither re-implements host pinning. The extraction is a pure move — no behaviour change — and `tests/unit/speaking-gateway.test.ts` is the check that it stayed that way.

`INTERNAL_USER_ID` moves with it and is shared by both demos. It is a declared user id for public demo traffic, not a per-user identity. Its derivation string stays exactly as it is — rewriting it would hand Speaking a different upstream identity, which is a behaviour change the extraction is not supposed to cause.

### Validation happens in the BFF

The contract rejects unknown fields rather than dropping them, and writes require an `Idempotency-Key`. Both are enforced at the boundary, never trusted from the browser.

- `assertSameOrigin` — CSRF guard, same as Speaking.
- Body at most 256 KB → `PAYLOAD_TOO_LARGE`. Measured on the raw text via `request.text()` before `JSON.parse`, so an oversized body is rejected without being parsed. Matches the endpoint's own limit.
- Per-task field allowlist. Task 1 accepts `task`, `question`, `essay`, `chart_type`, `image_url`. Task 2 accepts `task`, `question`, `essay`, `topic`. Any other key → `INVALID_REQUEST`.
- `question` and `essay` required, each at most 64 KB (an IELTS essay runs ~5 000 characters, well clear of the 256 KB body ceiling).
- Task 1: `chart_type` must be one of the seven `WRITING_TASK1_CHART_TYPES` values — the match is case-sensitive and `"bar chart"` is a 400.
- Task 1: `image_url` must parse as `https:` with no embedded username or password. **Not pinned to a host.** Speaking pins `s3.wispace.app` because AIHUB publishes that audio; a Task 1 chart is the user's own image on their own host, and pinning would reject every real submission.
- Task 2: `topic` must be one of `TOPICS`.

`Idempotency-Key` is `randomUUID()` per submit. Clicking "Chấm lại" is deliberately a new paid grade — the demo must not silently replay a stored result.

No automatic retry. A retry cannot reuse the key across two submits without re-keying, and re-keying turns a retry into a second charge. Failures surface; the user presses the button again.

### Errors pass through, messages do not

Speaking collapses upstream failures into seven generic codes. Writing does not: the 19 codes separate situations a demo visitor must be able to tell apart. `QUOTA_EXCEEDED` carries `retry_after_ms: 86_400_000`; reporting that as "service is busy, try again" is simply false. `FORBIDDEN` means the sandbox key lacks `writing.grade`, which is the single most likely misconfiguration while this demo is being built.

The gateway forwards upstream `code`, `retryable`, and `retry_after_ms`, and derives the HTTP status from the code. It replaces `message`, which is upstream free text and may describe internals, with a local Vietnamese message table. A code with no table entry gets a generic message; the code itself always reaches the client.

The client renders `{error.code, error.message}` inline, the way `speaking-workbench.tsx` does. No toast library exists in this repo and none is added.

### Result layout

Option A, chosen from three mockups. Reading order is band first, then detail:

1. Overall band in a dark header block, with `summary` beneath it.
2. Four criteria cards in one row, in the order the API returns them — Task 1 starts at `task_achievement`, Task 2 at `task_response`.
3. The essay, with each `annotations[].quote` highlighted in place and the `issue` plus `explanation` attached beneath the containing sentence.

Cards are `data-criteria`-keyed so a criterion card and its annotations read as one unit. `suggestions` and `next_steps` render as lists after the essay.

The annotation `issue` values in the published response examples (`imprecise_word_choice`, `underdeveloped_example`) are **not** in `ERROR_CODES` in `data/aiwriting.ts`. The demo renders `issue` as the plain string it is and does not attempt a lookup that would half-fail.

### Form

One workbench, two tabs, one form each. Fields are prefilled from `data/writing-task1-request.ts` and `data/writing-task2-request.ts`, so the page is runnable with no typing. Task 1 additionally shows `WRITING_TASK1_IMAGE_NOTE` under the URL field.

Nothing is persisted. No history, no draft storage — every page load starts from the samples.

## Files

| File                                     | Change                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `lib/sandbox-gateway.ts`                 | New. Transport extracted from `lib/speaking-gateway.ts`.                                                                         |
| `lib/speaking-gateway.ts`                | Imports the extracted transport. No behaviour change.                                                                            |
| `lib/scoring-gateway.ts`                 | New. Per-task validation, idempotency, upstream call, error mapping.                                                             |
| `data/scoring-response.ts`               | New. `WritingGradingData` / `WritingGradingEnvelope` plus a hand-written envelope parser, mirroring `data/speaking-response.ts`. |
| `app/api/demo/scoring/grade/route.ts`    | New. `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 90`.                                                      |
| `app/demo/scoring/page.tsx`              | New. ~15-line server shell, same shape as `app/demo/speaking/page.tsx`.                                                          |
| `app/demo/scoring/scoring-workbench.tsx` | New. Tabs, form, layout A.                                                                                                       |
| `app/demo/scoring/scoring.css`           | New. Demo-local styles.                                                                                                          |
| `data/api-products.ts`                   | `hasDemo`, `demoReady` → `true` (lines 57-58).                                                                                   |
| `tests/unit/scoring-gateway.test.ts`     | New. Table-driven cases for the parser.                                                                                          |

## Data flow

```
scoring-workbench.tsx  ('use client')
  │  POST /api/demo/scoring/grade
  │  { task: 1|2, question, essay, chart_type?, image_url?, topic? }
  ▼
app/api/demo/scoring/grade/route.ts
  │  gradeWriting(request, requestId)        lib/scoring-gateway.ts
  │    assertSameOrigin · body ≤ 256 KB · per-task allowlist
  │    chart_type ∈ 7 · image_url https · topic ∈ TOPICS
  │    Idempotency-Key = randomUUID()
  ▼
POST {sandbox}/v1/ielts/writing/task{task}/grade
  X-API-Key · X-User-Identity (minted) · X-Correlation-Id · Idempotency-Key
  ▼
parse envelope → { data, meta } → layout A
```

`meta` is rebuilt by the gateway as `{request_id, correlation_id, service: "writing", operation}`, matching what Speaking returns.

## Testing

`tests/unit/scoring-gateway.test.ts`, table-driven over `parseWritingRequest`:

- unknown field rejected, per task
- `chart_type` case-sensitivity (`"Bar Chart"` passes, `"bar chart"` fails)
- `image_url` on `http://` rejected; any https host accepted; credentials in the URL rejected
- `topic` outside `TOPICS` rejected
- `question` / `essay` missing, blank, or over 64 KB rejected
- body over 256 KB rejected
- task 2 body carrying `chart_type` rejected — the contract 400s rather than ignoring it

`tests/unit/speaking-gateway.test.ts` must stay green after the extraction. That is the regression check for the refactor.

An e2e spec is deliberately out of scope. The mock upstream plumbing (`AIHUB_SANDBOX_E2E_MOCK_BASE_URL`, `__test__/speaking/*`) would carry it cheaply, but no behaviour is specified at the page level that the unit parser does not already cover.

## Out of scope

- Uploading a chart image. The contract takes `image_url` only; there is no multipart endpoint for Writing. The one upload path in the repo is `POST /v1/me/avatar/uploads`, which is account-scoped and writes into avatar storage.
- Result history, draft persistence, per-user identity.
- Automatic retry.
- An e2e Playwright spec.
- Grading other Writing products (`exercise-generation`, `learning-path`) that are also unbuilt.

## Risks

- The sandbox may not expose `task1/grade` or `task2/grade`. `api-products.ts` documents the endpoints, not their sandbox availability. If they are absent, the failure is `404 NOT_FOUND` surfaced through the normal error path, and the sandbox key may need the `writing.grade` scope (`403 FORBIDDEN`). Both are distinguishable in the UI, which is why the codes pass through instead of collapsing.
- The sandbox key may lack `writing.grade` entirely.
