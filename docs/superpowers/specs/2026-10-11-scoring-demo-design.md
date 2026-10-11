# Chấm điểm demo — `/demo/scoring`

- Date: 2026-10-11
- Status: Approved in design review, awaiting spec review.
- Related: `docs/superpowers/specs/2026-09-27-sample-request-design.md` (§ Writing Scoring catalog), `app/demo/speaking/speaking-workbench.tsx`, `lib/speaking-gateway.ts`, the team's `Desktop · Prototype tương tác — Tổng quan + 5 bước` mockup (design reference for Task 1, not production code)

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
- `question` and `essay` required. `essay` is **1–20 000 characters**, the limit the endpoint documents (`data/api-reference.ts:624` for Task 1, `:672` for Task 2). `question` is capped at the same order — a few thousand characters — well clear of the 256 KB body ceiling.
- Task 1: `chart_type` must be one of the seven `WRITING_TASK1_CHART_TYPES` values — the match is case-sensitive and `"bar chart"` is a 400.
- Task 1: `image_url` must parse as `https:` with no embedded username or password. **Not pinned to a host.** Speaking pins `s3.wispace.app` because AIHUB publishes that audio; a Task 1 chart is the user's own image on their own host, and pinning would reject every real submission.
- Task 2: `topic` must be one of `TOPICS`.

`Idempotency-Key` is `randomUUID()` per submit. Clicking "Chấm lại" is deliberately a new paid grade — the demo must not silently replay a stored result.

No automatic retry. A retry cannot reuse the key across two submits without re-keying, and re-keying turns a retry into a second charge. Failures surface; the user presses the button again.

### Errors pass through, messages do not

Speaking collapses upstream failures into seven generic codes. Writing does not: the 19 codes separate situations a demo visitor must be able to tell apart. `QUOTA_EXCEEDED` carries `retry_after_ms: 86_400_000`; reporting that as "service is busy, try again" is simply false. `FORBIDDEN` means the sandbox key lacks `writing.grade`, which is the single most likely misconfiguration while this demo is being built.

The gateway forwards upstream `code`, `retryable`, and `retry_after_ms`, and derives the HTTP status from the code. It replaces `message`, which is upstream free text and may describe internals, with a local Vietnamese message table. A code with no table entry gets a generic message; the code itself always reaches the client.

The client renders `{error.code, error.message}` inline, the way `speaking-workbench.tsx` does. No toast library exists in this repo and none is added.

### Visual system

Every colour the demo uses is a token. That rule exists because the reference mockup and this repository disagree on the palette:

|       | `app/aihub.css` (repo) | reference mockup |
| ----- | ---------------------- | ---------------- |
| brand | `#3a64fa`              | `#5B5FEF`        |
| ink   | `#1d2838`              | `#14152B`        |
| body  | `#475467`              | `#5C5D77`        |
| line  | `#e4e7ec`              | `#E4E4EC`        |

The mockup's own README calls it a reference mockup, not a brand decision. `app/aihub.css` is the product's colour source of truth, and adopting `#5B5FEF` would be a site-wide rebrand including the live Speaking demo — a different piece of work with a different owner. So the demo uses the repository tokens.

What is taken from the mockup is its **system**, which is palette-independent:

- **Two token layers, bridged by fallback.** The demo page declares HSL triads at page scope (`--background: 210 40% 98%`, `--primary: 228 94% 60%`, `--radius: 16px`, `--app-font-sans`, `--app-font-mono`) while the global shell provides `--aihub-brand`, `--aihub-ink`, `--aihub-surface`, `--aihub-radius`. Speaking joins them with `var(--aihub-brand, #3a64fa)`. Scoring uses the same join.
- **Dark panels, not light cards.** `.console` is `#15151f` and `.feedback-dashboard` is `#1a1b25`, both monospace-forward, both with a large dashed empty state.
- **Two-column workbench shell.** `.lab-layout` is `288px minmax(0, 1fr)`, collapsing to one column at 720px with the main card ordered first.
- **Numbers are monospace.** `.score-value` renders at 19px in `--app-font-mono`.

Plus one thing the repository does not have: a **criterion colour scale**. Each of the four IELTS criteria owns a background, a text colour and an underline, and the same three colours drive the criterion badge, the essay highlight and the left rule on the criterion card, so colour alone tells the reader which criterion an error belongs to:

| Criterion                        | background | text      | underline |
| -------------------------------- | ---------- | --------- | --------- |
| Task Achievement / Task Response | `#DCEBFF`  | `#1F4F9E` | `#2F6FD6` |
| Coherence & Cohesion             | `#FFE9D6`  | `#8A4307` | `#B85C0A` |
| Lexical Resource                 | `#D9F2F0`  | `#0B5F59` | `#0F7A73` |
| Grammatical Range & Accuracy     | `#F1E4FA`  | `#6E2F91` | `#8A3FB0` |

These twelve values become tokens in the shared layer. They are a categorical scale, not brand colours, so they survive a future palette change.

If the design owner later confirms the mockup's palette is the new brand, this demo changes by editing token values alone. Nothing structural depends on the choice.

The shared rules move to `app/demo/demo-workbench.css`, imported by both demos. `speaking.css` keeps only what is specific to recording, transcription and the console, and loses its three near-identical copies of the token block.

### Page structure

Three regions, following the reference mockup:

1. **Overview** — hero carrying the endpoint path, plus the static five-step integration diagram (app → your server → AIHub). Static content, no logic, no state. It teaches the header contract that the demo itself cannot demonstrate.
2. **The workbench** — two columns: the form on the left, a sticky result panel on the right.
3. **Footer**, linking to the official documentation and the key-signup page.

### Result layout

Band first, then detail. Every element is either an existing Speaking component or a documented part of the criterion colour scale:

1. **Overall band** — the `.feedback-header` / `.score-badge` pair, with `summary` in the muted paragraph beneath it.
2. **Four criteria at a glance** — the `.feedback-grid` row of `.score-card`s, in the order the API returns them (Task 1 starts at `task_achievement`, Task 2 at `task_response`), each carrying its criterion's abbreviation badge in that criterion's colour.
3. **The essay** — each `annotations[].quote` rendered as a clickable `.word-chip` in its criterion's colour. Selecting one reveals its card beneath the essay: criterion badge, `issue`, the quoted text, and `explanation`. Clickable rather than tooltip-only, because the explanation is a full sentence and a hover target cannot hold it.
4. **The four criteria in full** — a two-column grid of cards with a left rule in the criterion colour, each showing name, band, `band_reason`, strengths and improvements.
5. **`suggestions` and `next_steps`** as two lists side by side.

The annotation `issue` values in the published response examples (`imprecise_word_choice`, `underdeveloped_example`) are **not** in `ERROR_CODES` in `data/aiwriting.ts`. The demo renders `issue` as the plain string it is and does not attempt a lookup that would half-fail.

### Form

Two tabs, one form each. Fields are prefilled from `data/writing-task1-request.ts` and `data/writing-task2-request.ts`, so the page is runnable with no typing. Task 1 shows `WRITING_TASK1_IMAGE_NOTE` under the URL field and previews the chart image, so the visitor can see they pointed at the right one before paying for a grade.

`chart_type` is a fixed choice list of the seven contract values. The endpoint is case-sensitive and rejects `"bar chart"` with a 400, so the form does not offer a spelling it would refuse; the case sensitivity is stated in the field's help text instead of being a trap.

The `Idempotency-Key` for the next submission is shown read-only above the submit button. It is displayed because it is the commonest integration mistake, and not editable because the demo's own rule is that pressing the button twice is two paid grades — a "generate a new key" control would contradict that.

While a grade is in flight, the panel shows progress against the 90-second client budget. No simulated delay, no simulated band.

Inputs use `.question-combobox-input` and the `.btn` / `.btn-primary` family; failures use the existing `.inline-error`, which the gateway's error codes already feed.

Nothing is persisted. No history, no draft storage — every page load starts from the samples.

## Files

| File                                     | Change                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `lib/sandbox-gateway.ts`                 | New. Transport extracted from `lib/speaking-gateway.ts`.                                                                         |
| `lib/speaking-gateway.ts`                | Imports the extracted transport. No behaviour change.                                                                            |
| `lib/scoring-gateway.ts`                 | New. Per-task validation, idempotency, upstream call, error mapping.                                                             |
| `data/scoring-response.ts`               | New. `WritingGradingData` / `WritingGradingEnvelope` plus a hand-written envelope parser, mirroring `data/speaking-response.ts`. |
| `app/demo/demo-workbench.css`            | New. Token block, base components, and the four-criterion colour scale. Shared by both demos.                                    |
| `app/demo/speaking/speaking.css`         | Imports the shared stylesheet. Keeps only recording, transcript and console rules. Drops its three duplicate token blocks.       |
| `app/api/demo/scoring/grade/route.ts`    | New. `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 90`.                                                      |
| `app/demo/scoring/page.tsx`              | New. ~15-line server shell, same shape as `app/demo/speaking/page.tsx`.                                                          |
| `app/demo/scoring/scoring-workbench.tsx` | New. Tabs, form, overview diagram, result layout.                                                                                |
| `app/demo/scoring/scoring.css`           | New. Writing-specific rules only — task tabs, chart preview. Nothing that belongs to the shared layer.                           |
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
- `question` / `essay` missing, blank, or outside 1–20 000 characters rejected
- body over 256 KB rejected
- task 2 body carrying `chart_type` rejected — the contract 400s rather than ignoring it

`tests/unit/speaking-gateway.test.ts` must stay green after the extraction. That is the regression check for the refactor.

The stylesheet extraction is checked visually, not by a snapshot: `/demo/speaking` renders identically before and after. The existing `tests/e2e/speaking.spec.ts` must still pass unchanged.

An e2e spec is deliberately out of scope. The mock upstream plumbing (`AIHUB_SANDBOX_E2E_MOCK_BASE_URL`, `__test__/speaking/*`) would carry it cheaply, but no behaviour is specified at the page level that the unit parser does not already cover.

## Out of scope

- Uploading a chart image. The contract takes `image_url` only; there is no multipart endpoint for Writing. The one upload path in the repo is `POST /v1/me/avatar/uploads`, which is account-scoped and writes into avatar storage.
- **An API key or User Identity input.** The reference mockup's first step collects an API key and a signed assertion, but that models the _customer's_ integration, not this demo. The BFF holds every credential, so such a field would connect to nothing and would teach the reader that they need to paste a key. That content already exists at `/product/scoring/api/grade-task1`; the demo links there instead.
- **Simulated error scenarios.** The mockup's fifth step replays five fabricated failures. A live sandbox cannot produce a 409, a missing identity header or a gateway timeout on demand, so each would have to be faked — contradicting the demo's whole premise, and duplicating the 19 error codes the documentation page already lists. Real errors surface through the pass-through path; the rest belong in the docs.
- **Simulated grades.** The mockup offers three fixed essays scored at 5.5, 6.5 and 7.5. A live sandbox returns the band it returns; offering a band picker would be theatre. One prefilled sample per task, as specified.
- **A simulated grading delay.** The mockup has a checkbox that adds ~42 seconds. There is a real progress state against the real 90-second budget instead.
- **A response-language toggle.** `language` is `vi` in the published responses; whether an `en` variant exists is unverified, so no toggle is built on an assumption.
- Result history, draft persistence, per-user identity.
- Automatic retry.
- An e2e Playwright spec.
- A site-wide rebrand to the mockup's palette.
- Grading other Writing products (`exercise-generation`, `learning-path`) that are also unbuilt.

## Risks

- The sandbox may not expose `task1/grade` or `task2/grade`. `api-products.ts` documents the endpoints, not their sandbox availability. If they are absent, the failure is `404 NOT_FOUND` surfaced through the normal error path, and the sandbox key may need the `writing.grade` scope (`403 FORBIDDEN`). Both are distinguishable in the UI, which is why the codes pass through instead of collapsing.
- The sandbox key may lack `writing.grade` entirely.
- The reference mockup's palette is unconfirmed as a brand decision. If it turns out to be one, the demo is correct but off-brand until the tokens are updated — a value-only change, tracked separately.
- The exact essay character limit of 20 000 is taken from this repository's own reference tables and has not been confirmed against a live response.
