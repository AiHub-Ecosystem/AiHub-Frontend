/**
 * One source of truth for every port the end-to-end suite binds.
 *
 * CI runs the suite as three shards at the same time, so every shard shifts
 * these ports by its own offset instead of sharing them. Outside CI there is no
 * offset and the ports are exactly what they have always been.
 *
 * The build directory shifts too, because shards writing one `.next` corrupt it
 * in a way that only surfaces as intermittent failures much later.
 */

const PORT_OFFSET = Number(process.env.E2E_PORT_OFFSET ?? 0);

function localUrl(port: number) {
  return `http://127.0.0.1:${port + PORT_OFFSET}`;
}

/** The primary app, and the browser's `baseURL`. */
export const appUrl = localUrl(3100);

/** A second app on its own build directory, for tests that need two origins. */
export const secondAppUrl = localUrl(3105);

/** The port the second app's `next dev` binds. */
export const secondAppPort = 3105 + PORT_OFFSET;

/** The mock AIHUB backend, which keeps the global state tests reset between runs. */
export const mockUrl = localUrl(3101);

/** The port the mock backend binds. Handed to the mock process, which is plain JS and cannot import this file. */
export const mockPort = 3101 + PORT_OFFSET;

export const redisUrl = `redis://127.0.0.1:${3103 + PORT_OFFSET}`;

export const redisPort = 3103 + PORT_OFFSET;

/** The primary app's build directory. Sharded only when there is an offset, so an unoffset run writes `.next` exactly as it always has. */
export const distDir = PORT_OFFSET === 0 ? ".next" : `.next-e2e-${PORT_OFFSET}`;

/** The second app's build directory. Always under `.next-e2e-`, which `.gitignore` already covers. */
export const secondaryDistDir =
  PORT_OFFSET === 0
    ? ".next-e2e-secondary"
    : `.next-e2e-${PORT_OFFSET}-secondary`;

/** The port the primary app's `next dev` binds. */
export const appPort = 3100 + PORT_OFFSET;

/** Names the shard's Redis container. Shard index is part of it: sibling shards are child processes of one shell and can share a pid. */
export function redisContainerName(shardIndex: number) {
  return `aihub-frontend-e2e-redis-${shardIndex}-${process.pid}`;
}
