# Enable email/password before Google OIDC

- Status: Accepted
- Date: 2026-09-23
- Issue: [#2](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/2)

To make Console access available sooner, the Customer Web will make AIHUB email/password its first active sign-in path and add Google OIDC later. This deliberately changes aihub-be ADR-0046's requirement to wait for both paths before cutover, while retaining its single-auth and browser/BFF credential boundary. Keep the `Đăng ký` header entry hidden until [#3](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/3) implements its route, and gate broad rollout to existing accounts on [#4](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/4)'s password-reset flow.
