# Keep the browser suite serial, and wait for hydration before clicking

- Status: Accepted
- Date: 2026-10-01
- Issue: [#46](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/46)
- Supersedes: [ADR-0014](0014-shard-browser-tests-in-one-job.md)

#46 asked for the browser suite to run as three parallel shards so the step could drop below 180s. ADR-0014 tried it, measured it, and found it made the step slower, so the suite stays serial at `workers: 1`. That is not only the mock's global state, which ADR-0014 already had to respect: a GitHub `ubuntu-latest` runner has 4 cores, three shards start six `next dev` servers between them, and individual tests slowed by 2.5-3.8x. Any future attempt at this issue should be measured on a 4-core machine first.

The attempt did find a real defect, and that part ships. Several tests clicked a button the dev server had already rendered but had not hydrated, and the click was silently dropped. This repo already had the remedy in `tests/e2e/hydration.ts`, written for exactly this; the tests simply were not calling it. It stayed invisible because the suite had the whole runner to itself, and three shards competing for the same 4 cores turned a rare flake into a reproducible failure in 15 tests.

Each such click now waits for hydration first, at the seam the test already has rather than at each call site: in the `signIn` helpers of `auth.spec.ts`, `organizations.spec.ts`, and `organization-api-keys.spec.ts`, and before the first click in the docs and organization tests that navigate directly. Waits were added to every `goto`-then-click site in those two files, not only to the ones that failed, because the same latent race was simply waiting for a slow day.

This ADR covers the serial suite and the hydration waits. It adds no dependency and changes no product code.
