# AIHUB-owned Customer Web sessions

- Status: Accepted
- Date: 2026-10-09
- Issue: [#50](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/50)
- Supersedes: Session-storage portion of [ADR-0001](0001-customer-web-console.md)

The Customer Web BFF uses AIHUB-owned Web Sessions instead of frontend Redis: the browser holds only the opaque HttpOnly cookie, and the BFF exchanges it server-to-server for a short-lived User Access JWT that may be cached in process memory until shortly before expiry. AIHUB owns session validation, renewal, expiry, and revocation; the session and browser cookie keep a 30-day sliding lifetime, and existing Redis sessions are not migrated so users sign in again at cutover. Production and staging require the BFF client secret from Vault before rollout. The BFF forwards nginx-overwritten `X-Real-IP` as `X-AIHUB-End-User-IP` for per-caller Web Session limits; it ignores any browser-supplied `X-AIHUB-End-User-IP`, and AIHUB validates the forwarded value. Logout always clears the browser cookie and attempts AIHUB revocation, but remote revocation cannot be guaranteed while AIHUB is unavailable.
