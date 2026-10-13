# Create production keys only from the Console

- Status: Accepted
- Date: 2026-09-28
- Supersedes: the Environment selection part of [ADR-0009](0009-customer-sandbox-environment.md)
- Amended by: [ADR-0017](0017-sandbox-backed-scoring-demo.md) for public demo use of Organization-owned Sandbox keys; the signed-in Console still creates Production-only keys under the current implementation. [ADR-0018](0018-explicit-demo-environments-and-safe-exports.md) accepts adding Sandbox/Production selection to the Console key form; that extension is pending implementation.

The create-key dialog no longer offers an Environment choice. Every key the Console creates allows `production` alone, and every request made with it — including a first test call — counts against the Organization's paid usage. The dialog says so above the scopes.

The Sandbox picker was removed to keep ordinary integration keys created in the Console on the billed Production tier. The backend still permits a caller of the Organization API to create a Sandbox-only key under the narrower scope policy implemented in [aihub-be PR #602](https://github.com/AiHub-Ecosystem/aihub-be/pull/602); this remains a Console decision, not a ban on customer Sandbox keys.

This decision applies to ordinary integration keys created in the signed-in Console. ADR-0017 adds a separate public demo flow where a visitor supplies an Organization-owned Sandbox key; it remains limited to Writing and Speaking grading scopes, the Sandbox host, and the Organization's existing Sandbox quota.

Existing Sandbox keys keep working. The key list still labels them, rotation still preserves their Environment, and the Sample request still resolves to the Sandbox host for them, so ADR-0009's host mapping and allowance copy stay in place for those keys.
