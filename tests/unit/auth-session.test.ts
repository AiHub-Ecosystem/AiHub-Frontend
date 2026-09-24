import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisState = vi.hoisted(() => ({
  session: null as string | null,
  lock: null as string | null,
}));
const evalRedis = vi.hoisted(() =>
  vi.fn(
    async (
      _script: string,
      options: { keys: string[]; arguments: string[] }
    ) => {
      if (options.keys.length === 2) {
        if (
          redisState.lock !== options.arguments[1] ||
          redisState.session === null
        )
          return 0;
        redisState.session = options.arguments[0];
        return "OK";
      }
      if (redisState.lock === options.arguments[0]) {
        redisState.lock = null;
        return 1;
      }
      return 0;
    }
  )
);
const redisClient = vi.hoisted(() => ({
  isReady: true,
  on: vi.fn(),
  connect: vi.fn(),
  get: vi.fn(async (_key: string) => {
    void _key;
    return redisState.session;
  }),
  set: vi.fn(
    async (_key: string, value: string, options?: { condition?: string }) => {
      void _key;
      if (options?.condition === "NX" && redisState.lock !== null) return null;
      redisState.lock = value;
      return "OK";
    }
  ),
  del: vi.fn(async (_key: string) => {
    void _key;
    const existed = redisState.session !== null;
    redisState.session = null;
    return Number(existed);
  }),
  expire: vi.fn(async () => 1),
  eval: evalRedis,
}));

vi.mock("redis", () => ({ createClient: () => redisClient }));

import {
  authenticatedAihubFetch,
  getCurrentWebSession,
} from "@/lib/auth-session";

const sessionId = "a".repeat(43);
beforeEach(() => {
  redisState.session = null;
  redisState.lock = null;
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.REDIS_URL;
  delete process.env.AIHUB_BASE_URL;
});

describe("server-held Web Session refresh", () => {
  it("refreshes and retries a protected AIHUB request after a 401", async () => {
    redisState.session = JSON.stringify({
      accessToken: "expired-access-token",
      accessTokenExpiresAt: Date.now() + 5 * 60_000,
      refreshToken: "refresh-token",
    });
    const authorization: string[] = [];
    const refreshCookies: string[] = [];
    let refreshCalls = 0;
    let protectedCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).endsWith("/v1/auth/refresh")) {
        refreshCookies.push(new Headers(init?.headers).get("cookie") ?? "");
        refreshCalls += 1;
        return new Response(
          JSON.stringify({
            data: {
              access_token: `new-access-token-${refreshCalls}`,
              expires_in: 900,
            },
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": `__Host-aihub_refresh=rotated-refresh-token-${refreshCalls}; Path=/; Secure; HttpOnly; SameSite=Strict`,
            },
          }
        );
      }
      authorization.push(new Headers(init?.headers).get("authorization") ?? "");
      protectedCalls += 1;
      return protectedCalls % 2 === 1
        ? new Response(null, { status: 401 })
        : Response.json({ ok: true });
    });

    const response = await authenticatedAihubFetch(sessionId, "/v1/protected");
    const secondResponse = await authenticatedAihubFetch(
      sessionId,
      "/v1/protected"
    );

    expect(response.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(authorization).toEqual([
      "Bearer expired-access-token",
      "Bearer new-access-token-1",
      "Bearer new-access-token-1",
      "Bearer new-access-token-2",
    ]);
    expect(refreshCookies).toEqual([
      "__Host-aihub_refresh=refresh-token",
      "__Host-aihub_refresh=rotated-refresh-token-1",
    ]);
  });

  it("deletes the Web Session when AIHUB rejects a refresh", async () => {
    redisState.session = JSON.stringify({
      accessToken: "expired-access-token",
      accessTokenExpiresAt: Date.now() - 1,
      refreshToken: "refresh-token",
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 401 })
    );

    const session = await getCurrentWebSession(sessionId);

    expect(session).toBeNull();
    expect(await getCurrentWebSession(sessionId)).toBeNull();
  });
});
