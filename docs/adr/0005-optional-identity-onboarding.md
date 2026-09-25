# Keep Identity Setup Optional After Organization Creation

- Status: Accepted
- Date: 2026-09-25
- Issue: [#9](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/9)

Present identity setup in a dialog that owners can open from the Organization overview or API-key page. After creating an Organization, open that dialog automatically but allow the owner to skip it; both a successful save and skipping continue to the API-key page. Keep the dialog available for editing existing configurations, regardless of whether roster readiness is present. Recommend a JWKS URL as the default source and offer inline public JWKS as a fallback. Identity setup is required for user-scoped grading, but Organization and API-key management must remain usable before an Organization has its own assertion-signing identity. Organization cards consistently open the Organization overview; API-key management is a separate action.
