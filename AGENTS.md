<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Backend

`AiHub-Ecosystem/aihub-be` is a separate checkout at `D:\aihub-be`. Nothing in this repo points into it, and the two answer to different questions.

- **Identity.** The demo sends a temporary random UUID from `app/demo/demo-session.tsx` as `X-User-Identity`, shared by Speaking and Writing for one demo visit; it never sends the signed-in AIHUB account identity. The backend resolver is `src/modules/identity/user-assertions/application/user-identity-resolver.ts`: it accepts a declared user ID only when the Organization has no active Identity Configuration. Demo key validation refuses Organizations with active Identity Configuration because the demo cannot sign an assertion for them.
- **Grading schemas.** `src/contracts/writing/grading.ts`. `chart_type` is a seven-value case-sensitive enum, so a select box is the only control that cannot produce a 400. `topic` and `question` are free text and must stay editable; a dropdown on either would teach a vocabulary the API does not have.
- **Operations.** `docs/operations/sandbox-provisioning.md` holds `key:create` and the identity-configuration setup; `docs/operations/deploy-vps.md` holds the rollback probes. Sandbox key creation is a documented runbook, not a SQL insert.
