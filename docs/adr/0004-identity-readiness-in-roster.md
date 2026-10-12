# Expose Identity Configuration Readiness in the Organization Roster

- Status: Accepted
- Date: 2026-09-25
- Issue: [#9](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/9)

The Customer Web needs to remind Organization members when identity setup is incomplete, while BE keeps issuer and JWKS details owner-only. Add a non-secret `identity_configured` readiness boolean to each Organization in the roster; it is true exactly when an active identity-config record exists, without probing current JWKS URL reachability. Keep detailed identity configuration reads and writes restricted to active owners. Show the reminder on the active Organization overview and API-key creation screen; for suspended Organizations, show the suspension state without an identity-setup prompt. Non-owners opening the identity route receive a read-only notice rendered from roster data, never a request for private configuration details. If an active owner reads a configuration whose status is disabled, keep its values editable but explain that saving cannot reactivate grading; only AIHUB can re-enable it. If a configuration request returns 403 after the page loaded, clear all displayed config values, refresh the roster, and render the safe read-only state instead of retrying the mutation.
