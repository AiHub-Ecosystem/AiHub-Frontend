# Record the Customer Web Console architecture

- Status: Accepted
- Date: 2026-09-23
- Issue: [#1](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/1)

## Context

This repository is the AIHUB Customer Web: the public site, API documentation, demos, and signed-in Console served from one origin. The repository planned as `aihub-sandbox-demo` was not restored; `AiHub-Frontend` is the Customer Web repository.

The current [aihub-be ADR-0046](https://github.com/AiHub-Ecosystem/aihub-be/blob/main/docs/adr/0046-customer-web-aihub-auth-identity-boundary.md) says the Customer Web repository is restored under its existing name, but it does not identify that name as `aihub-sandbox-demo`. This ADR records the repository identity accurately without attributing that exact name to the current ADR text.

ADR-0046 also describes the sandbox as invite-only and says public sign-up is not advertised. The Customer Web planning decision is to provide public registration and Self-serve Organization creation. The product direction differs, while the browser/BFF credential boundary from ADR-0046 remains required.

## Decision

- Treat `AiHub-Frontend` as the AIHUB Customer Web. The Customer Web includes public registration and a signed-in Console where a User Account manages Organizations, members, and API keys.
- Allow public User Account registration and email verification, and allow a User Account to create a Self-serve Organization in the Console. This is an intentional Customer Web product decision that replaces the invite-only sandbox sign-up policy described in ADR-0046; it does not change the backend's identity, membership, or authorization contracts.
- Keep all credentials out of the browser. The browser receives only an opaque Web Session cookie; the BFF holds the User Access JWT and Refresh Token in a Web Session stored in a dedicated Redis instance, separate from the control-plane Redis. API keys remain server-side and are never returned to the browser.
- Place the signed-in Console under `/console`. Include the Organization identifier in Organization routes, shaped as `/console/orgs/[organizationId]/...`.
- Keep email-link pages at `/verify-email`, `/reset-password`, and `/invite`, matching the paths used by backend emails.
- Use the already-installed Tailwind v4 and add no component library.
- Use Vietnamese for the UI. Keep technical names such as API key, JWKS, and issuer in English.

## Consequences

- Future Console slices must route credentialed AIHUB requests through the BFF and use the server-side Web Session; browser code must never receive access tokens, refresh tokens, or API keys.
- Dedicated Redis is required for Web Session storage and must not be shared with the control-plane Redis.
- Public registration and Self-serve Organization creation are Customer Web product policy. They intentionally differ from ADR-0046's invite-only sandbox language; the remaining applicable backend identity and session boundaries are retained.
- The email-link route paths are part of the integration contract and must stay aligned with backend-generated links.

## References

- [aihub-be ADR-0046: Customer Web identity boundary on AIHUB auth and Organization Membership](https://github.com/AiHub-Ecosystem/aihub-be/blob/main/docs/adr/0046-customer-web-aihub-auth-identity-boundary.md)
- [Issue #1: Console groundwork](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/1)
