import { afterEach, describe, expect, it, vi } from "vitest";

const PORT_OFFSET = "E2E_PORT_OFFSET";

afterEach(() => {
  delete process.env[PORT_OFFSET];
});

async function loadPorts(offset?: string) {
  if (offset === undefined) delete process.env[PORT_OFFSET];
  else process.env[PORT_OFFSET] = offset;
  // The module reads the offset once at load, so each case needs a fresh copy.
  vi.resetModules();
  return await import("@/tests/e2e/ports");
}

describe("e2e port offset", () => {
  it("keeps today's ports and build directory when no shard is configured", async () => {
    const ports = await loadPorts();

    expect(ports.appUrl).toBe("http://127.0.0.1:3100");
    expect(ports.mockUrl).toBe("http://127.0.0.1:3101");
    expect(ports.secondAppUrl).toBe("http://127.0.0.1:3105");
    expect(ports.redisUrl).toBe("redis://127.0.0.1:3103");
    expect(ports.distDir).toBe(".next");
    expect(ports.secondaryDistDir).toBe(".next-e2e-secondary");
  });

  it("gives two shards disjoint ports and build directories", async () => {
    const first = await loadPorts("0");
    const second = await loadPorts("10");

    expect(second.appUrl).toBe("http://127.0.0.1:3110");
    expect(second.mockUrl).toBe("http://127.0.0.1:3111");
    expect(second.secondAppUrl).toBe("http://127.0.0.1:3115");
    expect(second.redisUrl).toBe("redis://127.0.0.1:3113");
    expect(second.distDir).toBe(".next-e2e-10");
    expect(second.secondaryDistDir).toBe(".next-e2e-10-secondary");
    expect(second.redisPort).not.toBe(first.redisPort);
  });

  it("names the Redis container per shard so siblings cannot collide", async () => {
    const ports = await loadPorts();

    expect(ports.redisContainerName(1)).not.toBe(ports.redisContainerName(2));
  });
});
