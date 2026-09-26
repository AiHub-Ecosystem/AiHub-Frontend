import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/verify-email/route";

const redisState = vi.hoisted(() => ({
  values: new Map<string, string>(),
  failSessionRead: false,
  failSessionWrite: false,
}));
const redisClient = vi.hoisted(() => ({
  isReady: true,
  on: vi.fn(),
  connect: vi.fn(),
  get: vi.fn(async (key: string) => {
    if (redisState.failSessionRead)
      throw new Error("Redis session read failed");
    return redisState.values.get(key) ?? null;
  }),
  set: vi.fn(async (key: string, value: string) => {
    if (redisState.failSessionWrite)
      throw new Error("Redis session persistence failed");
    redisState.values.set(key, value);
    return "OK";
  }),
  del: vi.fn(async (key: string) => Number(redisState.values.delete(key))),
  expire: vi.fn(async () => 1),
  eval: vi.fn(async () => "OK"),
}));

vi.mock("redis", () => ({ createClient: () => redisClient }));

function verifyRequest(token: unknown, cookie?: string) {
  const headers = new Headers({
    Origin: "http://localhost:3100",
    "Content-Type": "application/json",
  });
  if (cookie) headers.set("Cookie", cookie);
  return new Request("http://localhost:3100/api/auth/verify-email", {
    method: "POST",
    headers,
    body: JSON.stringify({ token }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CUSTOMER_WEB_ORIGIN;
  delete process.env.AIHUB_BASE_URL;
  delete process.env.REDIS_URL;
  redisState.values.clear();
  redisState.failSessionRead = false;
  redisState.failSessionWrite = false;
});

describe("Customer Web email verification BFF", () => {
  it("forwards the verification token server-side and returns no-store 204", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    const response = await POST(verifyRequest("opaque-token"));

    expect(response.status).toBe(303);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("location")).toBe(
      "http://localhost:3100/login?verified=1"
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3101/v1/auth/verify-email",
      expect.objectContaining({
        body: JSON.stringify({ token: "opaque-token" }),
      })
    );
  });

  it("preserves the current session and revokes the new token when Redis cannot save it", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    process.env.REDIS_URL = "redis://localhost:6379";
    const oldSessionId = "o".repeat(43);
    const browserBinding = "b".repeat(43);
    redisState.values.set(
      `customer-web:session:${oldSessionId}`,
      JSON.stringify({
        accessToken: "old-access-token",
        accessTokenExpiresAt: Date.now() + 60_000,
        refreshToken: "old-refresh-token",
      })
    );
    redisState.failSessionWrite = true;
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        if (String(input).endsWith("/v1/auth/verify-email"))
          return Response.json(
            { data: { access_token: "new-access-token", expires_in: 900 } },
            {
              headers: {
                "Set-Cookie":
                  "__Host-aihub_refresh=new-refresh-token; Path=/; Secure; HttpOnly; SameSite=Strict",
              },
            }
          );
        if (String(input).endsWith("/v1/auth/logout"))
          return new Response(null, { status: 204 });
        throw new Error(`Unexpected fetch: ${String(input)} ${String(init)}`);
      });

    const response = await POST(
      verifyRequest(
        "opaque-token",
        `__Host-aihub_web_session=${oldSessionId}; __Host-aihub_signup=${browserBinding}`
      )
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "UNAVAILABLE" } });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(redisState.values.has(`customer-web:session:${oldSessionId}`)).toBe(
      true
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:3101/v1/auth/verify-email",
      expect.objectContaining({
        body: JSON.stringify({
          token: "opaque-token",
          browser_binding: browserBinding,
        }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:3101/v1/auth/logout",
      expect.objectContaining({
        headers: { Cookie: "__Host-aihub_refresh=new-refresh-token" },
      })
    );
  });

  it("revokes the new token when Redis cannot read the current session", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    process.env.REDIS_URL = "redis://localhost:6379";
    redisState.failSessionRead = true;
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        if (String(input).endsWith("/v1/auth/verify-email"))
          return Response.json(
            { data: { access_token: "new-access-token", expires_in: 900 } },
            {
              headers: {
                "Set-Cookie":
                  "__Host-aihub_refresh=new-refresh-token; Path=/; Secure; HttpOnly; SameSite=Strict",
              },
            }
          );
        if (String(input).endsWith("/v1/auth/logout"))
          return new Response(null, { status: 204 });
        throw new Error(`Unexpected fetch: ${String(input)}`);
      });

    const response = await POST(
      verifyRequest(
        "opaque-token",
        `__Host-aihub_web_session=${"o".repeat(43)}`
      )
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:3101/v1/auth/logout",
      expect.objectContaining({
        headers: { Cookie: "__Host-aihub_refresh=new-refresh-token" },
      })
    );
  });

  it("revokes a new token when AIHUB returns an invalid sign-in envelope", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        if (String(input).endsWith("/v1/auth/verify-email"))
          return Response.json(
            { data: { access_token: 123, expires_in: 900 } },
            {
              headers: {
                "Set-Cookie":
                  "__Host-aihub_refresh=new-refresh-token; Path=/; Secure; HttpOnly; SameSite=Strict",
              },
            }
          );
        if (String(input).endsWith("/v1/auth/logout"))
          return new Response(null, { status: 204 });
        throw new Error(`Unexpected fetch: ${String(input)}`);
      });

    const response = await POST(
      verifyRequest("opaque-token", `__Host-aihub_signup=${"b".repeat(43)}`)
    );

    expect(response.status).toBe(503);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:3101/v1/auth/logout",
      expect.objectContaining({
        headers: { Cookie: "__Host-aihub_refresh=new-refresh-token" },
      })
    );
  });

  it.each(["", "x".repeat(513), null])(
    "rejects missing or out-of-range token (%s) without contacting AIHUB",
    async (token) => {
      process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
      const fetch = vi.spyOn(globalThis, "fetch");

      const response = await POST(verifyRequest(token));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: { code: "AUTH_VERIFICATION_TOKEN_INVALID" },
      });
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it("sanitizes invalid-token and rate-limit responses", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: "AUTH_VERIFICATION_TOKEN_INVALID",
              message: "secret",
            },
          },
          { status: 400 }
        )
      )
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "RATE_LIMITED", retry_after_ms: 17_000 } },
          { status: 429 }
        )
      );

    const invalid = await POST(verifyRequest("bad-token"));
    const limited = await POST(verifyRequest("limited-token"));

    expect(await invalid.json()).toEqual({
      error: { code: "AUTH_VERIFICATION_TOKEN_INVALID" },
    });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({
      error: { code: "RATE_LIMITED", retry_after_seconds: 17 },
    });
  });
});
