# Accept Organization-signed assertions in public scoring demos

- Status: Proposed
- Date: 2026-10-16
- Issue: [AiHub-Frontend #78](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/78)
- Depends on: [aihub-be #687](https://github.com/AiHub-Ecosystem/aihub-be/issues/687)
- Amends: [ADR-0018](0018-explicit-demo-environments-and-safe-exports.md) for identity handling in Writing and Speaking demos

## Decision

After successful API-key validation, the demos use the backend's `user_identity_mode`: `declared_id` keeps the existing generated User ID behavior, while `signed_assertion` accepts a short-lived JWT issued by the Organization's own backend. Missing or unknown modes fail closed, with no usable identity input and no upload or grading submission. AIHUB and the browser never receive the Organization's private signing key and never mint assertions.

One assertion is shared by Writing and Speaking for the current demo visit and is forwarded unchanged as `X-User-Identity` on identity-scoped live requests. The assertion is masked by default with an explicit reveal control, held only in visit memory, and cleared when the API key or environment changes or the visit ends. A failed live authentication remains a failure; the entered assertion stays available for correction or replacement. Its maximum value size is 6 KiB to leave room within common 8 KiB HTTP header-field limits.

Request traces and copied/exported request examples show a redacted marker or placeholder instead of the assertion. The validated API key continues to follow ADR-0020. Live authentication failures are shown as failures and never replaced with sample success.

## Consequences

Visitors need to obtain a current assertion from their Organization's backend and may need to replace it after expiry. The 6 KiB frontend limit is below the backend verifier's 32 KiB limit; supporting larger assertions requires confirming and raising limits across the deployed HTTP path.

## Acceptance checks

- Identity input appears only after successful key validation and matches the backend's recognized mode.
- Invalid or missing mode prevents identity-scoped submissions and gives a retry/support error without exposing configuration.
- Signed assertions are sent unchanged for Writing chart upload and grading, and Speaking grading.
- The raw assertion is absent from traces, copied/exported requests, browser storage, URLs, logs, and analytics.
- Invalid assertions remain visible as live failures; no mock success is shown.
