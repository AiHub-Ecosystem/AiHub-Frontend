# RULE 02 — ENGINEERING & CODING

> Core principle: Code is written to be read, tested, and modified. The "Definition of Done" is a contract—there is no such thing as "almost done."

---

## A. Code Architecture

1. **Clear layer separation:** presentation / application (business logic) / domain / infrastructure. Business logic must remain agnostic of frameworks, HTTP, or DB drivers—enabling independent testing and infrastructure changes without breaking the core.
2. **Dependency rule:** dependencies flow in one direction only—outer layers depend on inner layers, never the reverse. Frameworks are implementation details, not the center.
3. **No circular dependencies** between modules—CI must block them.
4. Business logic must be **testable without network/DB access** (via interfaces + dependency injection).
5. **No premature abstraction.** Follow the "Rule of Three": accept duplication until the third instance before abstracting. Incorrect abstraction is costlier than duplicated code.
6. Functions/classes should do one thing. Files exceeding ~400 lines or functions exceeding ~50 lines signal a need for splitting—not a hard rule, but exceeding these limits requires justification during code review.
7. All configurations (API keys, connection strings, feature flags) must reside in environment variables or a config store—**never hardcode them**.

---

## B. Security (Non-negotiable)

8. **Never commit secrets** (API keys, passwords, tokens) to the repo—including in tests, comments, example files, or Git history. Secrets must be handled via environment variables or secret managers; CI must include secret scanning. Violation = immediate key rotation.
9. **Treat all external input as untrusted:** validate at the system boundary (schema validation), use parameterized queries (SQL string concatenation is forbidden), escape output (prevent XSS), and limit payload size.
10. **Separate AuthN and AuthZ; enforce checks server-side for every endpoint**—never trust the client. All endpoints require authentication by default; public endpoints must be explicitly declared. Apply the principle of least privilege to all service accounts and API keys.
11. **For API marketplaces:** Every customer API key must include rate limits, defined scopes, immediate revocation capabilities, and audit logs.
12. Sensitive data (PII, credentials) must not appear in logs, error messages returned to the client, or analytics. Errors returned to the client must be generic messages; details belong in internal logs. PII must be encrypted at rest and in transit, with mechanisms for deletion upon request. User data must not be included in prompts sent to third-party models without authorization.
13. Third-party dependencies must undergo automated vulnerability scanning within the CI pipeline (e.g., `npm audit`, `pip-audit`, or equivalent); adding a new dependency requires a justification in the Pull Request (PR)—treat every dependency as technical debt. Exercise particular caution with AI-suggested dependencies, as they may be outdated or non-existent.

---

## C. Conventions

14. **Automated formatting and linting—no debates:** Use a single formatter and linter for the entire repository, running automatically in CI; code that fails checks cannot be merged. Style debates end at the configuration file, not during code reviews.
15. **Use "Ubiquitous Language" (domain-specific terminology):** Variable, function, and table names must match the terminology used by the Product Owner; maintain consistent terminology for concepts across the codebase (e.g., if a concept is called `order`, do not refer to it as `purchase` elsewhere). Good naming serves as its own documentation.
16. **Follow the Conventional Commits standard** (e.g., `feat:`, `fix:`, `refactor:`, `docs:`, `test:`...); each commit should represent a single logical change. Branch naming format: `type/ticket-id-short-description`.
17. **Keep PRs small:** Aim for fewer than 400 lines of changes. Larger PRs must be split or accompanied by an explanation of why splitting is not possible. 18. Comments should explain **"why,"** not "what"—the code already expresses the "what." Delete dead code (Git preserves history); do not comment it out to keep for later.

---

## D. Testing

19. **Tests must accompany the code in the same PR.** No "adding tests later" PRs. New business logic code without tests will not be merged.
20. **Follow the test pyramid:** many unit tests (fast, no I/O) → moderate integration tests for boundaries (DB, API) → few E2E tests for critical flows (registration, payment, core API calls). Recommended coverage ≥ 80% for the domain/application layers; do not chase coverage metrics for the UI or glue code layers.
21. **Every bug fix must include a test that reproduces the bug**—fixed bugs must not regress.
22. **Tests must be deterministic:** no dependency on execution order, real-time clocks, or actual network connections. Mock/stub external services at the unit level; use test containers at the integration level.
23. **Red test = stop everything.** Do not merge when CI fails; do not skip or disable tests just to "let it pass." Fix or delete flaky tests; do not tolerate them.
24. Tests should assert **behavior via public interfaces**, not implementation details—this ensures refactoring doesn't break the tests.
25. **For AI features:** maintain a fixed evaluation set to measure output quality across prompt or model changes—changing a prompt is equivalent to changing code and must undergo testing.

---

## E. Documentation

26. Minimum repository documentation: `README` (enabling the project to run within 15 minutes), `AGENTS.md` (this policy), a `docs/adr/` directory (Architecture Decision Records), API documentation generated from contracts (OpenAPI/schema—no manual writing), and a `CHANGELOG` for public releases.
27. **Documentation must live alongside the code and be updated in the same PR** as the related changes. Documentation that diverges from the code is worse than having no documentation at all.

---

## F. Code Review

28. All changes to the main branch must undergo review—including code written by agents, and **especially code written by agents**.
29. Reviewers share equal responsibility with the author for approved code.
30. Authors must **review their own diffs** before opening a PR.

---

## G. Definition of Done

A task is declared **DONE** only when it meets the **entire** checklist—criteria must be specific and measurable; "almost done" is not acceptable:

- [ ] Meets all acceptance criteria defined in the spec
- [ ] Tests written and passing (unit + integration for relevant components); CI Green
- [ ] CI checks passed (linting, formatting, security scans)
- [ ] Self-reviewed own diff before opening the PR
- [ ] Code review approved
- [ ] Relevant documentation updated (API docs, ADR, CHANGELOG) if behavior or decisions changed
- [ ] No secrets, debug code, dead code, or orphaned TODOs left behind
- [ ] Logging/metrics implemented for the new flow (if it's a production feature)
- [ ] Rollback path in place (feature flags, reversible migrations) for risky changes
- [ ] Actually executed and observed real output—no guessing that it "probably works"
- [ ] Reported using the standard format (Rule 00, Section F)

> **"It works on my machine" is not "done." Merging isn't "done." "Done" means the feature is running in production, is measurable, and can be turned off if necessary.**