# Lock the demo during a live grade, offer fixed questions, keep answers out of agent prompts

- Status: Accepted
- Date: 2026-10-13
- Related: [Issue #69](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/69), [FE PR #70](https://github.com/AiHub-Ecosystem/AiHub-Frontend/pull/70)
- Amends: [ADR-0018](0018-explicit-demo-environments-and-safe-exports.md)

## Decision

Implementing ADR-0018 settled three points the original text left open or stated more broadly than the shipped design.

**Grade lock.** A live grade in either skill locks key and environment changes in both skills until its request finishes. The demo keeps one visit-wide key and environment, so a change made from the other skill mid-grade would otherwise send a request under one selection and display its result under another.

**Selection generation.** Key, environment, scope, and request generation are bound together by a counter that increases on every real change of key or environment, and on clearing the visit. A validation response that arrives after the visitor returned to an earlier selection is therefore still discarded: the key and environment alone match again in that case, the generation does not.

**Three fixed questions.** Each Writing Task and Speaking Part offers three fixed local question choices. Choosing one changes the displayed request question only. The sample answer or transcript and the grading result stay fixed per task or part, and mock submit still makes no network call.

**Agent prompt.** Shell and Postman exports serialize and quote the visitor's answer for the target format. The agent prompt does not carry the answer at all: it uses a body placeholder, asks for a text example only, and does not ask the agent to read local secrets, run tools, send requests, or retry billable work. This narrows ADR-0018's "user-authored answers and prompts are serialized and shell-quoted for the target format" for the prompt only.

## Consequences

A visitor cannot start a second grade, in either skill, while one is in flight, and cannot change key or environment until it ends. An agent given the prompt must be handed the answer by the visitor; the prompt never includes it.

Quoting for PowerShell treats the typographic single quotes U+2018 to U+201B as quote characters and doubles them, because PowerShell reads them as single quotes.

## Acceptance checks

- Changing key or environment from the other skill is blocked while a live grade is in flight.
- A stale validation response is discarded after the key or environment changed and then changed back.
- The agent prompt contains neither the visitor's answer nor the API key value.
- PowerShell output keeps an answer containing `’` inside the quoted body literal.

ADR-0018's note that implementation is pending is satisfied by FE PR #70 once it is merged and deployed.
