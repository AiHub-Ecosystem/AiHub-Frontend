# Lock the demo during a live grade, offer fixed questions, and generate commands from agent prompts

- Status: Accepted
- Date: 2026-10-13
- Related: [Issue #69](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/69), [FE PR #70](https://github.com/AiHub-Ecosystem/AiHub-Frontend/pull/70)
- Amends: [ADR-0018](0018-explicit-demo-environments-and-safe-exports.md)

## Decision

Implementing ADR-0018 settled three points the original text left open or stated more broadly than the shipped design.

**Grade lock.** A live grade in either skill locks key and environment changes in both skills until its request finishes. The demo keeps one visit-wide key and environment, so a change made from the other skill mid-grade would otherwise send a request under one selection and display its result under another.

**Selection generation.** Key, environment, scope, and request generation are bound together by a counter that increases on every real change of key or environment, and on clearing the visit. A validation response that arrives after the visitor returned to an earlier selection is therefore still discarded: the key and environment alone match again in that case, the generation does not.

**Three fixed questions.** Each Writing Task and Speaking Part offers three fixed local question choices. Choosing one changes the displayed request question only. The sample answer or transcript and the grading result stay fixed per task or part, and mock submit still makes no network call.

**Agent prompt.** The prompt asks an AI to format the current request as ready-to-copy Bash cURL, PowerShell `curl.exe`, and Postman cURL commands. It includes the request body as data, uses environment-variable placeholders for API keys, and explicitly forbids running tools or sending requests. Production prompts include a brief cost warning. The prompt creates command text only; users run or import it themselves.

## Consequences

A visitor cannot start a second grade, in either skill, while one is in flight, and cannot change key or environment until it ends. The generated prompt includes the current body so the returned commands are usable without manual payload assembly. It never includes the visitor's API key.

Quoting for PowerShell treats the typographic single quotes U+2018 to U+201B as quote characters and doubles them, because PowerShell reads them as single quotes.

## Acceptance checks

- Changing key or environment from the other skill is blocked while a live grade is in flight.
- A stale validation response is discarded after the key or environment changed and then changed back.
- The agent prompt asks for Bash, PowerShell, and Postman cURL commands, never sends a request, and contains no API key value.
- PowerShell output keeps an answer containing `’` inside the quoted body literal.

ADR-0018's note that implementation is pending is satisfied by FE PR #70 once it is merged and deployed.
