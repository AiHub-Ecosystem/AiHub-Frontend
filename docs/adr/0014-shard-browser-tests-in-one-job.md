# Run the browser suite as three shards inside one CI job

- Status: Accepted
- Date: 2026-10-01
- Issue: [#46](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/46)
- Related: [#45](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/45)

The `browser-tests` job's own test step measures 379s, and 347s of that is test execution across 117 tests. The suite runs serially — `fullyParallel: false` with `workers: 1` — because the mock backend keeps global state and resets it through `__test__` endpoints between tests, so two tests running at once would read each other's state. The way to shorten the step without touching that constraint is to run several whole-suite copies at once and let them share nothing: each shard gets its own mock backend, its own app instance, its own second app instance, and its own Redis.

The shards run inside one job rather than as a GitHub Actions matrix, and that is deliberate. A three-job matrix pays the same 57s of setup on three separate runners and reaches nearly the same wall-clock, because the cost is paid concurrently either way. What one job avoids is paying for it three times in runner-minutes, which is the resource this change is actually buying. It costs six `next dev` processes on one runner instead of two, and the 180s target in the issue is an estimate written before any shard existed; the number that gets measured is recorded in the pull request, and if it lands above 180s the acceptance criterion is renegotiated with the measured figure rather than met by cutting the suite short.

Isolation is a single port offset, not a set of per-service variables. Every port the suite binds shifts by the shard's offset, and the primary app's `NEXT_DIST_DIR` shifts with it, because three `next dev` processes sharing one `.next` corrupt it in a way that surfaces as intermittent failures days later rather than as an immediate error. The offset is zero outside CI, so a developer running the suite locally gets today's ports and today's build directories unchanged.

Shards divide by file, not by test, because that is what `fullyParallel: false` means to Playwright's shard filter. The heaviest shard is whatever single file lands in it — `organization-api-keys.spec.ts` at 119s cannot be split, so neither a larger shard count nor shard weights can reduce the longest shard; they only move already-light files around. Shard balance is therefore accepted as uneven, and `PWTEST_SHARD_WEIGHTS` is left unused because it distributes test counts, which is not the quantity being balanced.

A shard's Playwright process is a child of the same shell as its siblings, so `process.pid` cannot be relied on to name the Redis container uniquely; the shard index joins it. A failing shard does not cancel its siblings — all three run to completion and the job fails at the end, so one red run reports three shards of evidence instead of one.

This ADR covers shard isolation, the port offset, and how the job aggregates failures. It changes no test, adds no dependency, and leaves the suite at `workers: 1` within a shard.
