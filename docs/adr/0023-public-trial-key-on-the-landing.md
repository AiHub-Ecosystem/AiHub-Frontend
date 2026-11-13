# Publish a capped Sandbox trial key on the landing page

- Status: Accepted (frontend); backend caps pending
- Date: 2026-11-13
- Amends: [ADR-0017](0017-sandbox-backed-scoring-demo.md), which kept anonymous visitors from spending real grading quota
- Related: [ADR-0009](0009-customer-sandbox-environment.md), [ADR-0019](0019-demo-grade-lock-fixed-questions-and-agent-prompt.md)

## Decision

The home page prints one real Sandbox API key, a copy-ready prompt that tells an AI agent how to call Writing Task 2 grading with it, and the equivalent cURL command. The goal is a first call with no sign-up: a developer pastes the command, an agent or a non-technical visitor (a CEO evaluating the product) pastes the prompt.

The key is public by design. It is not protected by secrecy, so the frontend does not proxy or hide it; the visitor calls `sandbox.aihubproduction.com` directly. What bounds the cost is the backend:

- the key belongs to a dedicated **Public Trial** Organization, separate from AIHUB's demo Organization and every customer;
- that Organization's Sandbox allowance is raised so a daily cap, not the 25-per-month default, is what binds;
- the backend refuses the key after **100 dispatches per UTC day** in total and **10 per caller IP per UTC day**, with `429 QUOTA_EXCEEDED` and a `retry_after_ms` to the next UTC midnight.

The frontend reads the key from `AIHUB_PUBLIC_TRIAL_API_KEY` at request time and publishes it only if it is a well-formed `aihub_sandbox_` key. A Production or dual-environment key in that variable is refused and the page shows a placeholder, so a configuration mistake cannot print a paid credential. With no key configured the section still renders, with `<AIHUB_TRIAL_KEY>` in the copied text and a link to create a Sandbox key.

The 100 and 10 figures and the 00:00 UTC reset are copy in `lib/public-trial.ts`, not read from the API, which exposes none of them. This is the same accepted drift ADR-0009 records for the Sandbox allowance.

## Alternatives considered

A frontend proxy that holds the real key server-side and counts calls was rejected by the product owner in favour of a key that works against the public API directly, so the copied prompt matches what an integration will really send. The proxy would have kept the real key private and been buildable without backend work.

## Consequences

- Until aihub-be enforces the two caps, **do not set `AIHUB_PUBLIC_TRIAL_API_KEY` in production**. Without the caps, the key would only be bounded by the Organization's monthly Sandbox allowance, and one caller could exhaust it for everyone.
- The key is scraped and reused outside the landing page. That is acceptable only because of the caps; rotating it means a new key in env and a redeploy, and old copies of the prompt stop working.
- One heavy user can still take 10 of the day's 100; ten IPs can take all of it. The per-IP cap narrows abuse, it does not prevent it.
- The prompt instructs agents not to retry on 429, so an agent loop does not spend the shared allowance on retries.

## Backend work (aihub-be)

1. Create the Public Trial Organization and a Sandbox key with `writing.grade` only, no Identity Configuration (the prompt sends a declared `X-User-Identity`).
2. Enforce per-key daily caps: 100 per UTC day for the key, 10 per UTC day per `X-AIHUB-Visitor-IP` / caller IP, returning `429 QUOTA_EXCEEDED` with `retry_after_ms`.
3. Raise that Organization's Sandbox monthly allowance above 100 × 31.
4. Hand the raw key to whoever sets `AIHUB_PUBLIC_TRIAL_API_KEY` on the frontend deployment.

## Acceptance checks

- The landing shows the key, a prompt and a cURL command; both copy to the clipboard.
- The prompt names the endpoint, headers, body, both caps, the stop-on-429 rule and the register URL.
- The cURL command parses in bash back into the exact sample body.
- A Production, dual-environment or malformed key in the variable is never published.
