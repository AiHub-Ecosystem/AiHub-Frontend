# Keep Operator-Disabled Identity Configuration Under AIHUB Control

- Status: Accepted
- Date: 2026-09-25
- Issue: [#9](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/9)
- Related: [aihub-be ADR-0049](https://github.com/AiHub-Ecosystem/aihub-be/blob/main/docs/adr/0049-owner-managed-organization-identity-configuration.md)

When BE returns a disabled identity configuration, an active owner may view and edit its issuer and public JWKS, but the UI must state that saving does not restore grading. Only AIHUB can reactivate an operator-disabled configuration; the Customer Web must not imply that an owner can override that control.
