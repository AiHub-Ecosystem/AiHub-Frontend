import { spawnSync } from "node:child_process";
import { createConnection } from "node:net";
import { redisContainerName, redisPort } from "./ports";

function pingRedis() {
  return new Promise<boolean>((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port: redisPort });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export default async function globalSetup() {
  const container = redisContainerName(
    Number(process.env.E2E_SHARD_INDEX ?? 1)
  );
  const started = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "--detach",
      "--name",
      container,
      "--publish",
      `127.0.0.1:${redisPort}:6379`,
      "redis:7-alpine",
      "redis-server",
      "--appendonly",
      "yes",
    ],
    { encoding: "utf8" }
  );
  if (started.status !== 0)
    throw new Error(
      started.stderr || "Unable to start isolated Redis container"
    );

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && !(await pingRedis())) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!(await pingRedis())) {
    spawnSync("docker", ["stop", "--timeout", "2", container], {
      stdio: "ignore",
    });
    throw new Error("Isolated Redis did not become ready");
  }

  return async () => {
    spawnSync("docker", ["stop", "--timeout", "2", container], {
      stdio: "ignore",
    });
  };
}
