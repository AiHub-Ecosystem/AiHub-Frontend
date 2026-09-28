# Create production keys only from the Console

- Status: Accepted
- Date: 2026-09-28
- Supersedes: the Environment selection part of [ADR-0009](0009-customer-sandbox-environment.md)

The create-key dialog no longer offers an Environment choice. Every key the Console creates allows `production` alone, and every request made with it — including a first test call — counts against the Organization's paid usage. The dialog says so above the scopes.

The Sandbox picker was removed because the product wants one billed tier for customers, not a free Writing-only side door. aihub-be still accepts `sandbox` on `allowed_environments`, so this is a Console decision, not a backend one; a caller of the API directly can still mint a Sandbox key.

Existing Sandbox keys keep working. The key list still labels them, rotation still preserves their Environment, and the Sample request still resolves to the Sandbox host for them, so ADR-0009's host mapping and allowance copy stay in place for those keys.
