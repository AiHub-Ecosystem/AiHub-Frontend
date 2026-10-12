# Return Stable Reasons for Identity Source Validation

- Status: Accepted
- Date: 2026-09-25
- Issue: [#9](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/9)

The Customer Web must explain identity-source failures without parsing backend prose. Map BE's `IDENTITY_JWKS_URL_UNSAFE`, `IDENTITY_JWKS_SOURCE_UNAVAILABLE`, and `IDENTITY_JWKS_INVALID` codes to safe guidance; never recommend HTTP, localhost, or internal hosts. Duplicate issuer remains its existing `ORGANIZATION_IDENTITY_ISSUER_CONFLICT` conflict. Track the roster readiness field and these validation reasons together in [aihub-be #165](https://github.com/AiHub-Ecosystem/aihub-be/issues/165), a dependency of FE issue #9. Playwright covers user-visible setup, role, reminder, validation, and disabled states; BE tests cover readiness semantics and stable reason codes.
