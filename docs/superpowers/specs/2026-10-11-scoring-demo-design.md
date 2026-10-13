# Chấm điểm demo — `/demo/scoring`

- Date: 2026-10-11
- Status: Superseded by [ADR-0017](../../adr/0017-sandbox-backed-scoring-demo.md), [ADR-0018](../../adr/0018-explicit-demo-environments-and-safe-exports.md), and follow-up issue [#69](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/69).
- Related: `docs/superpowers/specs/2026-09-27-sample-request-design.md` (§ Writing Scoring catalog), `app/demo/speaking/speaking-workbench.tsx`, `lib/speaking-gateway.ts`, the team's `Desktop · Prototype tương tác — Tổng quan + 5 bước` mockup (design reference for Task 1, not production code). Field limits, identity behaviour and sandbox ceilings in this spec were verified against the `aihub-be` source, not against this repository's reference tables, which had drifted.

> Historical proposal only. Its signed-assertion and Sandbox-only transport decisions were superseded; use the linked ADRs and current backend contracts for implementation behavior.

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

`lib/speaking-gateway.ts` mixes two concerns: sandbox transport (host pinning, env resolution, same-origin, upstream status mapping) and Speaking-specific work (audio fields, parts, extensions, signed-assertion minting). Writing needs the first and none of the second.

Extract the transport into `lib/sandbox-gateway.ts`. Both gateways import it; neither re-implements host pinning. The extraction is a pure move — no behaviour change — and `tests/unit/speaking-gateway.test.ts` is the check that it stayed that way.

`mintSandboxAssertion` moves into the shared transport. This reverses the original decision, which kept it Speaking-only on the reasoning that Writing had no business on an allowlist-guarded path. That reasoning was wrong about the consequence: the mint is not optional for Writing, because the resolver treats an Organization's identity configuration as authoritative.

`INTERNAL_USER_ID` moves with it. Its derivation string stays exactly as it is — rewriting it would hand Speaking a different upstream identity, which is a behaviour change the extraction is not supposed to cause.

### Identity: a minted assertion, not a declared user id

**This section previously specified a plain declared user id and was wrong.** It cited `writing-user-identity.controller.spec.ts` grading `student_456` with a 200, which is true of the _declared_ code path and irrelevant: that test's own configuration has no active identity config, which is the only case where a declared id is accepted.

`UserIdentityResolver.resolve` reads the Organization's configuration first. When one is active it verifies the header value as a Signed User Assertion and rejects anything else, with no fallback. Only the absence of a configuration admits a declared id. The sandbox Organization has one, so the demo answered `401 INVALID_USER_IDENTITY` on every grade.

The rule is therefore about the Organization's state, not the value's shape, and no choice of declared id survives it. Writing mints an assertion for the same `INTERNAL_USER_ID` Speaking uses, and the identity is whichever the configuration demands. This holds whether or not a configuration exists, which a declared id cannot.

The demo still exposes nothing: no identity configuration, no signing, no user id asked of the visitor. The assertion is minted in the BFF from the same constant.

### Validation happens in the BFF

The backend schemas are `additionalProperties: false`, so an unknown field is a 400 rather than something quietly dropped, and `Idempotency-Key` is a required header. Both are enforced at the boundary, never trusted from the browser.

- `assertSameOrigin` — CSRF guard, same as Speaking.
- Body at most 256 KB → `PAYLOAD_TOO_LARGE`. Measured on the raw text via `request.text()` before `JSON.parse`, so an oversized body is rejected without being parsed. Matches the endpoint's own limit.
- Per-task field allowlist. Task 1 accepts `task`, `question`, `essay`, `chart_type`, `image_url`. Task 2 accepts `task`, `question`, `essay`, `topic`. Any other key → `INVALID_REQUEST`. These mirror the upstream schemas minus the one field the demo does not forward.
- `question` required, 1–2 000 characters. `essay` required, 1–20 000 characters.
- Task 1: `chart_type` must be one of the seven `WRITING_TASK1_CHART_TYPES` values. The match is case-sensitive and `"bar chart"` is a 400.
- Task 1: `image_url` required, 1–2 000 characters, must parse as an `https:` URL with no embedded username or password. **Not pinned to a host.** The backend pins Speaking audio to `s3.wispace.app` because AIHUB publishes it; Writing has no host allowlist at all, and its own tests assert a customer-hosted chart URL is forwarded unchanged. Pinning would reject every real submission.
- Task 2: `topic` required, 1–200 characters, **free text**. The contract accepts any non-empty string here, so the form does not constrain it to the published `TOPICS`. An allowlist on this field would refuse every real essay — the same trap as pinning an `image_url` host.
- `language` is **not** in the allowlist. The upstream schema accepts an optional `language`, but the demo never sends one, so allowing it would mean accepting `"en"`, dropping it, and returning a Vietnamese grade under a 200. A field the demo will not forward is a field it refuses.

`Idempotency-Key` is minted in the gateway, not in the browser. The demo page is read by visitors, who are not running an integration: they have no server, no key and no retry to attach one to, and a hex string in the form teaches a detail about a system they do not operate. A UUID satisfies the 1–255 byte rule by construction, so there is nothing left for the page to do. This also matches how a customer actually integrates — their server generates the key — and it removes the browser-minted state that had to be reconciled with hydration.

The header contract is still taught where it belongs: step 3 of the overview above the workbench explains that a real integration sends one key per submission.

Pressing the button twice is deliberately a new key and therefore a new paid grade. The demo never silently replays a stored result.

No automatic retry. A retry cannot reuse the key across two submits without re-keying, and re-keying turns a retry into a second charge. Failures surface; the user presses the button again.

### Errors pass through, messages do not

Speaking collapses upstream failures into seven generic codes. Writing does not: the 19 codes separate situations a demo visitor must be able to tell apart. `QUOTA_EXCEEDED` carries `retry_after_ms: 86_400_000`; reporting that as "service is busy, try again" is simply false. `FORBIDDEN` means the sandbox key lacks `writing.grade`, which is the single most likely misconfiguration while this demo is being built.

The gateway forwards upstream `code`, `retryable`, and `retry_after_ms`, and derives the HTTP status from the code. It replaces `message`, which is upstream free text and may describe internals, with a local Vietnamese message table. A code with no table entry gets a generic message; the code itself always reaches the client.

The client renders `{error.code, error.message}` inline, the way `speaking-workbench.tsx` does. No toast library exists in this repo and none is added.

### Visual system

`#5B5FEF` is the new brand. `app/aihub.css` still carries `#3a64fa` from the repository's first commit and has never been changed, so the two coexist:

| role                        | `app/aihub.css` (current site) | new brand, per the mockup |
| --------------------------- | ------------------------------ | ------------------------- |
| brand                       | `#3a64fa`                      | `#5B5FEF`                 |
| brand hover                 | `#3157dc`                      | `#4547C9`                 |
| brand tint background       | —                              | `#EDEBFE`                 |
| brand tint border           | —                              | `#D5D1FB`                 |
| ink                         | `#1d2838`                      | `#14152B`                 |
| body                        | `#475467`                      | `#5C5D77`                 |
| muted / disabled            | —                              | `#9C9DC2`                 |
| line                        | `#e4e7ec`                      | `#E4E4EC`                 |
| surface                     | `#f1f5f9`                      | `#F7F7FB`                 |
| strong border               | —                              | `#C7C7D9`                 |
| success                     | —                              | `#0F6B4C`                 |
| warning background / border | —                              | `#FFF4E5` / `#F5D3A6`     |
| warning text                | —                              | `#8A4307`                 |
| code / emphasis             | —                              | `#9A3B12`                 |
| error text                  | —                              | `#B3261E`                 |
| console surface             | `#15151f`                      | `#14152B`                 |
| console header              | `#080808`                      | `#1E2040`                 |
| console border              | `#272836`                      | `#33355A`                 |
| console text                | `#d6dae8`                      | `#F3F3FA`                 |

The Scoring demo ships on the new brand. The rest of the site stays on `#3a64fa` until its own migration, which is separate work with a different owner.

That split is only safe if the brand is a **token the page sets**, never a value baked into a rule. `app/demo/demo-workbench.css` declares every colour in terms of `--demo-brand`, `--demo-ink`, `--demo-surface` and the rest. Speaking sets them to the current site values; Scoring sets them to the new brand. When the rest of the site migrates, the demo's page-level block is deleted and the new values become the defaults — one change, no component rule edited.

What is taken from the mockup beyond the palette, and is independent of it:

- **Two token layers, bridged by fallback.** The demo page declares HSL triads at page scope while the global shell provides `--aihub-brand`, `--aihub-ink`, `--aihub-surface`, `--aihub-radius`. Speaking joins them with `var(--aihub-brand, #3a64fa)`. Scoring uses the same join, pointed at the new brand.
- **Dark panels, not light cards.** The console and feedback surfaces are monospace-forward with a large dashed empty state.
- **Two-column workbench shell.** `.lab-layout` is `288px minmax(0, 1fr)`, collapsing to one column at 720px with the main card ordered first.
- **Numbers are monospace.** `.score-value` renders at 19px in `--app-font-mono`.

Plus one thing the repository does not have: a **criterion colour scale**. Each of the four IELTS criteria owns a background, a text colour and an underline, and the same three colours drive the criterion badge, the essay highlight and the left rule on the criterion card, so colour alone tells the reader which criterion an error belongs to:

| Criterion                        | background | text      | underline |
| -------------------------------- | ---------- | --------- | --------- |
| Task Achievement / Task Response | `#DCEBFF`  | `#1F4F9E` | `#2F6FD6` |
| Coherence & Cohesion             | `#FFE9D6`  | `#8A4307` | `#B85C0A` |
| Lexical Resource                 | `#D9F2F0`  | `#0B5F59` | `#0F7A73` |
| Grammatical Range & Accuracy     | `#F1E4FA`  | `#6E2F91` | `#8A3FB0` |

These twelve values are a categorical scale, not brand colours, so they are identical under either palette and move to the shared layer unchanged.

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

The form shows no idempotency key and no control to regenerate one. The gateway owns the key and the visitor has nothing to configure. The demo's own rule — pressing the button twice is two paid grades — is stated in the help text, not implied by a key the reader cannot use.

While a grade is in flight, the panel shows progress against the 90-second client budget. No simulated delay, no simulated band.

Inputs use `.question-combobox-input` and the `.btn` / `.btn-primary` family; failures use the existing `.inline-error`, which the gateway's error codes already feed.

Nothing is persisted. No history, no draft storage — every page load starts from the samples.

## Files

| File                                     | Change                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `lib/sandbox-gateway.ts`                 | New. Transport extracted from `lib/speaking-gateway.ts`, including assertion minting, which both gateways need.                  |
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
| `tests/e2e/scoring.spec.ts`              | New. The page-level wiring the parser cannot reach.                                                                              |

## Data flow

```
scoring-workbench.tsx  ('use client')
  │  POST /api/demo/scoring/grade
  │  header: (none from the browser — the gateway mints Idempotency-Key)
  │  body: { task: 1|2, question, essay, chart_type?, image_url?, topic? }
  ▼
app/api/demo/scoring/grade/route.ts
  │  gradeWriting(request, requestId)        lib/scoring-gateway.ts
  │    assertSameOrigin · body ≤ 256 KB · per-task allowlist
  │    question ≤ 2000 · essay ≤ 20000 · topic ≤ 200 · image_url ≤ 2000 https
  │    chart_type ∈ 7 (case-sensitive) · Idempotency-Key 1–255 bytes
  ▼
POST {sandbox}/v1/ielts/writing/task{task}/grade
  X-API-Key · X-User-Identity (minted assertion) · X-Correlation-Id · Idempotency-Key
  ▼
parse envelope → { data, meta } → result layout
```

`meta` is rebuilt by the gateway as `{request_id, correlation_id, service: "writing", operation}`, matching what Speaking returns.

## Testing

`tests/unit/scoring-gateway.test.ts`, table-driven over `parseWritingRequest`:

- `unknown field rejected, per task — the backend schemas are additionalProperties: false, so a stray field is a 400 rather than something ignored`
- `chart_type` case-sensitivity (`"Bar Chart"` passes, `"bar chart"` fails)
- `image_url` on `http://` rejected; any https host accepted; credentials in the URL rejected
- `question` over 2 000 characters rejected; `essay` over 20 000 rejected; `topic` over 200 rejected
- `image_url` over 2 000 characters rejected
- body over 256 KB rejected
- task 2 body carrying `chart_type` rejected — the contract 400s rather than ignoring it
- a `language` field rejected on both tasks, rather than accepted and dropped
- a criteria array that is short, empty, repeated or carries an unknown id rejected as a contract violation rather than rendered as a grade
- the upstream identity is a Signed User Assertion minted for the declared user id

`tests/unit/speaking-gateway.test.ts` must stay green after the extraction. That is the regression check for the refactor.

The stylesheet extraction is checked visually, not by a snapshot: `/demo/speaking` renders identically before and after. The existing `tests/e2e/speaking.spec.ts` must still pass unchanged.

An e2e spec was scoped out on the grounds that no page-level behaviour was specified that the unit parser did not already cover. Building the page falsified that: what only a browser can see is the wiring the parser cannot reach — that the demo is reachable with no login, that no credential reaches the page, that the report renders the criteria in the order the response carried, and that Task Achievement and Task Response wear the same colour. `tests/e2e/scoring.spec.ts` covers those, on the existing mock upstream (`AIHUB_SANDBOX_E2E_MOCK_BASE_URL`, `__test__/scoring/*`).

## Out of scope

- Uploading a chart image. The contract takes `image_url` only; there is no multipart endpoint for Writing. The one upload path in the repo is `POST /v1/me/avatar/uploads`, which is account-scoped and writes into avatar storage.
- **An API key or User Identity input.** The reference mockup's first step collects an API key and a signed assertion, but that models the _customer's_ integration, not this demo. The BFF holds every credential, so such a field would connect to nothing and would teach the reader that they need to paste a key. That content already exists at `/product/scoring/api/grade-task1`; the demo links there instead.
- **Simulated error scenarios.** The mockup's fifth step replays five fabricated failures. A live sandbox cannot produce a 409, a missing identity header or a gateway timeout on demand, so each would have to be faked — contradicting the demo's whole premise, and duplicating the 19 error codes the documentation page already lists. Real errors surface through the pass-through path; the rest belong in the docs.
- **Simulated grades.** The mockup offers three fixed essays scored at 5.5, 6.5 and 7.5. A live sandbox returns the band it returns; offering a band picker would be theatre. One prefilled sample per task, as specified.
- **A simulated grading delay.** The mockup has a checkbox that adds ~42 seconds. There is a real progress state against the real 90-second budget instead.
- **A response-language toggle.** `language` is `vi` in the published responses; whether an `en` variant exists is unverified, so no toggle is built on an assumption.
- Result history, draft persistence, per-user identity.
- Automatic retry.
- The rest of the site migrating to `#5B5FEF`. The Scoring demo ships on the new brand; every other surface stays on `#3a64fa` until that work happens. The shared stylesheet is built so this costs one block of token values when it does.
- Grading other Writing products (`exercise-generation`, `learning-path`) that are also unbuilt.

## Risks

- **The sandbox has ceilings.** A public demo shares one Organization with every other visitor. The sandbox tier allows 5 requests per minute per key, 1 in-flight request per Organization, 25 dispatches per month per Organization, and 500 per month for the whole environment. A popular demo will hit these, and `QUOTA_EXCEEDED` is the code that says so — which is exactly why the codes pass through instead of collapsing into "service busy". The rate limit and the concurrency limit are the two a visitor will actually meet.
- **The sandbox key may lack `writing.grade`.** A Sandbox key is issued only with exactly that scope, so this should hold; if it does not, the demo fails on its first request with `403 FORBIDDEN` and the fix is an Operations task, not a code change.
- `criteria` arrives in the documented order, but nothing enforces it. The order comes from a lexicographic sort of the downstream service's numbered keys. The demo renders whatever order it receives rather than re-sorting, so a change upstream shows up rather than being masked.
- The exact field limits are taken from the backend schemas rather than from this repository's reference tables, which had drifted from them.
- On a 4xx the backend deletes the idempotency record, on a 5xx it marks it failed and reclaimable only by an identical body. With a fresh key per submit the demo never encounters either, which is the reason for that choice.
