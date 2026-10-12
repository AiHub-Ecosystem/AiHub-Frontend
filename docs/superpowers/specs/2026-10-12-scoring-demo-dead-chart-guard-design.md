# Scoring demo: do not spend a grade on a chart the visitor cannot see

**Date:** 2026-10-12
**Status:** approved, implementing
**Related:** `2026-10-11-scoring-demo-design.md` (the demo itself)

## Problem

Task 1 requires `image_url`. `isFetchableImageUrl` in `lib/scoring-gateway.ts`
checks its **shape** — https, no whitespace, no embedded credentials, at most
2 000 characters. It cannot check **reachability**, and nothing else on the page
does either: the preview `<img>` at `app/demo/scoring/scoring-workbench.tsx:242`
has no `onError`.

So a well-formed but dead URL passes validation, is forwarded, and the grading
service fetches nothing, grades the essay anyway, and returns a confident band.
The visitor sees a plausible score attached to a chart that was never read.

The cost is not the wrong number. The sandbox allows 25 dispatches per
Organization per month, and the demo does not auto-retry, so one dead URL spends
4% of the month's budget to learn nothing. The existing note under the field
says this in prose; prose does not stop a click.

## Why the check cannot be a hard block

The obvious implementation — disable Chấm whenever `onError` fires — is wrong,
and the reason is worth recording because it looks like an implementation detail
and is not.

`onError` fires when _the visitor's browser_ cannot load the image. That includes
hotlink protection, a `Referer` policy, and CORS-free cross-origin rules that
block embedding but not fetching. The grading service fetches the URL
server-side, with no visitor `Referer` and no browser restrictions.

The same image can therefore fail in the preview and grade correctly. A hard
block would reject a valid submission, on the strength of a signal that does not
mean what it appears to mean.

## Design

Reuse the request the browser already makes. The preview `<img>` already loads
`draft.imageUrl`; an `onError` handler on it costs no extra network call and no
quota.

Three states, driven by two pieces of state:

- `chartLoadFailed: boolean` — set on `onError`, cleared on `onLoad` and when
  the visitor edits the URL, so a corrected URL re-arms the check instead of
  inheriting a stale verdict.
- `chartOverride: boolean` — the visitor's explicit acknowledgement that the
  image is expected to fail here and should still be graded.

**When the image fails**, an inline warning appears under the preview naming
both causes, and Chấm is disabled until the visitor either fixes the URL — the
warning clears on its own — or ticks the acknowledgement.

**When the visitor edits the URL**, `chartLoadFailed` and `chartOverride` both
reset. The new URL decides afresh.

The acknowledgement exists because the signal is ambiguous, not because the
visitor's judgement is required in general. One tick is cheaper than rejecting a
submission the backend would have graded.

### Scope

Not covered, deliberately:

- **Empty or malformed URLs.** `isFetchableImageUrl` already rejects these in
  the BFF before any dispatch is spent. A client-side gate would be a second
  door to a room that is already locked.
- **Task 2**, which carries no chart.
- **Upload.** Unchanged, and still out of scope per the parent spec: the
  contract takes `image_url` only, and an upload button needs a public https URL
  to be worth anything, which is infrastructure this page deliberately does not
  have.
- **The request body.** This change adds no field and removes none. The body
  sent to `/api/demo/scoring/grade` is byte-identical before and after.

## Verification

Red first, then implement. The e2e suite mocks upstream and routes
`s3.wispace.app` locally, so a dead URL is a path the mock does not serve.

1. A dead URL shows the warning and disables Chấm.
2. Ticking the acknowledgement re-enables Chấm, and the request that follows is
   the same body as an unblocked submission.
3. Replacing a dead URL with a live one clears the warning with no tick.
4. Task 2 is untouched — no warning, Chấm enabled.
5. The existing suite still passes unchanged.
