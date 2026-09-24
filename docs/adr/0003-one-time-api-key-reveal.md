# One-time API-key reveal

- Status: Accepted
- Date: 2026-09-25
- Issue: [#6](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/6)

ADR-0001 keeps API keys server-side and says they are never returned to the browser. Issue #6 requires an owner or admin to receive a newly minted key so it can be installed in their service. Without a one-time reveal, the issued credential cannot be used by its owner.

Allow the Customer Web BFF to return a newly minted raw API key once, only in the create or rotate response, for immediate display to an active Organization owner or admin. Mark the response `Cache-Control: no-store`. Keep the raw value out of the Web Session, browser storage, logs, analytics, and navigation state, and discard it when the dialog closes or the page is left. All other User Access JWTs, Refresh Tokens, and stored API-key material remain server-side.

This is a narrow exception to ADR-0001's browser credential boundary. The UI must never offer recovery after the initial create or rotate response is gone.
