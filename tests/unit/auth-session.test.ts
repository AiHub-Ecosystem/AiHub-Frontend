import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessions = vi.hoisted(() => new Map<string, string>());
const evalRedis = vi.hoisted(() =>
  vi.fn(
    async (
      _script: string,
      options: { keys: string[]; arguments: string[] }
    ) => {
      if (options.keys.length === 2) {
        const [sessionKey, lockKey] = options.keys;
        if (
          sessions.get(lockKey) !== options.arguments[1] ||
          !sessions.has(sessionKey)
        ) {
          return 0;
        }
        sessions.set(sessionKey, options.arguments[0]);
        return "OK";
      }
      if (sessions.get(options.keys[0]) === options.arguments[0]) {
        sessions.delete(options.keys[0]);
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
  get: vi.fn(async (key: string) => sessions.get(key) ?? null),
  set: vi.fn(
    async (key: string, value: string, options?: { condition?: string }) => {
      if (options?.condition === "NX" && sessions.has(key)) return null;
      sessions.set(key, value);
      return "OK";
    }
  ),
  del: vi.fn(async (key: string) => Number(sessions.delete(key))),
  expire: vi.fn(async () => 1),
  eval: evalRedis,
}));

vi.mock("redis", () => ({ createClient: () => redisClient }));

import {
  authenticatedAihubFetch,
  getCurrentWebSession,
} from "@/lib/auth-session";

const sessionId = "a".repeat(43);
const sessionKey = `customer-web:session:${sessionId}`;

beforeEach(() => {
  sessions.clear();
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
    sessions.set(
      sessionKey,
      JSON.stringify({
        accessToken: "expired-access-token",
        accessTokenExpiresAt: Date.now() + 5 * 60_000,
        refreshToken: "refresh-token",
      })
    );
    const authorization: string[] = [];
    let refreshCookie = "";
    let protectedCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).endsWith("/v1/auth/refresh")) {
        refreshCookie = new Headers(init?.headers).get("cookie") ?? "";
        return new Response(
          JSON.stringify({
            data: { access_token: "new-access-token", expires_in: 900 },
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie":
                "__Host-aihub_refresh=rotated-refresh-token; Path=/; Secure; HttpOnly; SameSite=Strict",
            },
          }
        );
      }
      authorization.push(new Headers(init?.headers).get("authorization") ?? "");
      protectedCalls += 1;
      return protectedCalls === 1
        ? new Response(null, { status: 401 })
        : Response.json({ ok: true });
    });

    const response = await authenticatedAihubFetch(sessionId, "/v1/protected");

    expect(response.status).toBe(200);
    expect(authorization).toEqual([
      "Bearer expired-access-token",
      "Bearer new-access-token",
    ]);
    expect(refreshCookie).toBe("__Host-aihub_refresh=refresh-token");
    expect(JSON.parse(sessions.get(sessionKey)!).refreshToken).toBe(
      "rotated-refresh-token"
    );
  });

  it("deletes the Web Session when AIHUB rejects a refresh", async () => {
    sessions.set(
      sessionKey,
      JSON.stringify({
        accessToken: "expired-access-token",
        accessTokenExpiresAt: Date.now() - 1,
        refreshToken: "refresh-token",
      })
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 401 })
    );

    const session = await getCurrentWebSession(sessionId);

    expect(session).toBeNull();
    expect(sessions.has(sessionKey)).toBe(false);
  });
});
