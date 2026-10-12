# Do not shard the browser suite in one CI job

- Status: Superseded by [ADR-0015](0015-serial-browser-suite-stays-serial.md)
- Date: 2026-10-01
- Issue: [#46](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/46)
- Related: [#45](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/45)

**This ADR records a decision that was measured, did not work, and was reverted.** It is kept because the reasoning was sound and the measurement still explains why the suite stays serial.

The plan was to run three shards of the browser suite side by side inside one job. Each shard would get its own mock backend, app instance, second app instance, and build directory, so no shard could read another's state. The suite would stay serial _within_ a shard; the parallelism would be between shards. AIHUB-owned Web Sessions supersede this plan's frontend Redis fixture; the current auth suite needs no Redis service.

Measured on CI, this made the step slower, not faster: 420s against the 379s baseline it was meant to replace, with test time rising from 347s to 963.6s. The cause is CPU contention, not sharding logic. GitHub's `ubuntu-latest` runner has 4 cores, and three shards each start two `next dev` servers; individual tests slowed by 2.5-3.8x (`auth.spec.ts` went from 49.6s to 188.8s). Running the shards in parallel multiplies wall-clock here rather than dividing it.

Two errors fed the decision, both worth naming. The first was estimating contention rather than measuring it: the 180s target in the issue assumed shard time divides, and nobody checked what a 4-core runner does with six dev servers. The second was treating a local measurement as evidence. A developer machine measured 207s, which looked like a clear win, but it had more cores than the runner that actually runs CI — a number that never predicted the CI result.

One finding from the attempt survives and is kept: `fullyParallel: false` means Playwright shards by whole file, not by test, so the heaviest shard is bounded below by the slowest single file (`organization-api-keys.spec.ts`, 119s). Neither a larger shard count nor `PWTEST_SHARD_WEIGHTS` can reduce the longest shard, because weights distribute test counts rather than duration and a file cannot be split. Any future attempt at this issue should start from a runner with the same core count as CI, or from fewer shards, and should measure before writing the implementation.
