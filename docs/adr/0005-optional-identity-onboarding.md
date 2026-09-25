# Keep Identity Setup Optional After Organization Creation

- Status: Accepted
- Date: 2026-09-25
- Issue: [#9](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/9)

After creating an Organization, guide its owner through identity setup but allow them to skip it; both a successful save and skipping continue to the API-key page. Recommend a JWKS URL as the default source and offer inline public JWKS as a fallback. Identity setup is required for user-scoped grading, but Organization and API-key management must remain usable before an Organization has its own assertion-signing identity.
