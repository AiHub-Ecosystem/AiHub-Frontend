# Use customer Sandbox keys for live Writing and Speaking demos

- Status: Accepted
- Date: 2026-10-13
- Issue: [#68](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/68)
- Related: [BE PR #602](https://github.com/AiHub-Ecosystem/aihub-be/pull/602), [ADR-0009](0009-customer-sandbox-environment.md), [ADR-0011](0011-console-creates-production-keys-only.md)
- Amends: ADR-0009 for public-demo live grading and the permitted Sandbox scopes

The public Writing and Speaking demos accept an optional Organization-owned Sandbox API key from either anonymous or signed-in visitors. The key may carry `writing.grade`, `speaking.grade`, or both; each page checks its own required scope. Without an eligible key, the demos show fixed read-only fixtures and a clearly labelled Mock result; submit stays local and does not dispatch a grading request. A matching Sandbox key enables editable answers and real grading through the Customer Web BFF. The key is shared across both demo pages for one visit, held only for that visit, and cleared when the visitor leaves the demo or signs out. Each step shows its request and response while redacting credentials.

The first-step validation is a usability check, not an authorization grant: the backend validates the key's Sandbox-only environment and the current skill's scope without reserving a grading dispatch, then authenticates it again on every live grading request. The key's Organization owns the request and its existing Sandbox quota; the signed-in AIHUB account is not used to choose or bind that Organization. One random UUID per demo visit serves as the Declared User ID across both skills, preventing an AIHUB username from being attributed as an end user of an unrelated Organization. An Organization with active Identity Configuration is refused because the demo cannot supply an assertion signed by that Organization; it must fail closed until that input exists.

This separates customer demo traffic from AIHUB's own server-held demo key and prevents anonymous visitors without a customer key from spending real grading quota. Persisting a supplied key would make return visits easier but would extend its exposure beyond the demo visit, so it remains temporary. The signed-in Console remains Production-only under ADR-0011; the Organization API can create Sandbox-only demo keys with the selected skill scopes under the related backend policy. This decision applies to the public demo flow.
