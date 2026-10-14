import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as createOrganization } from "@/app/api/organizations/route";
import { POST as activity } from "@/app/api/auth/session/route";
import {
  authenticatedAihubFetch,
  cachedWebSessionCount,
  clearWebSessionCache,
  getCurrentWebSession,
} from "@/lib/auth-session";

const origin = "http://localhost:3100";
const token = "w".repeat(43);

function sessionRequest() {
  return new Request(`${origin}/api/auth/session`, {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: `__Host-aihub_web_session=${token}`,
      "Content-Type": "application/json",
      "X-Real-IP": "198.51.100.10",
      "X-AIHUB-End-User-IP": "192.0.2.99",
    },
    body: "{}",
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const sessionToken of [
    token,
    "x".repeat(43),
    "o".repeat(43),
    "r".repeat(43),
  ])
    clearWebSessionCache(sessionToken);
  delete process.env.AIHUB_BASE_URL;
  delete process.env.AIHUB_WEB_SESSION_CLIENT_SECRET;
  delete process.env.CUSTOMER_WEB_ORIGIN;
});

describe("AIHUB Web Session BFF", () => {
  it("exchanges the HttpOnly cookie server-side and renews its browser lifetime", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = origin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    process.env.AIHUB_WEB_SESSION_CLIENT_SECRET = "server-only-secret";
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        data: { access_token: "jwt-server-only", expires_in: 900 },
      })
    );

    const response = await activity(sessionRequest());

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain(
      `__Host-aihub_web_session=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict`
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3101/v1/auth/web-sessions/exchange",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "X-AIHUB-Client-Secret": "server-only-secret",
          "X-AIHUB-End-User-IP": "198.51.100.10",
        },
        body: JSON.stringify({ web_session_token: token }),
        cache: "no-store",
      })
    );
    expect(response.headers.get("set-cookie")).not.toContain("jwt-server-only");
  });

  it("clears a rejected session cookie on 401 and preserves it on 503", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = origin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    const expired = await activity(sessionRequest());
    const unavailable = await activity(
      new Request(`${origin}/api/auth/session`, {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: `__Host-aihub_web_session=${"x".repeat(43)}`,
        },
      })
    );

    expect(expired.status).toBe(401);
    expect(expired.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get("set-cookie")).toBeNull();
  });

  it("uses the exchanged JWT only for the authenticated AIHUB request", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = origin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    process.env.AIHUB_WEB_SESSION_CLIENT_SECRET = "server-only-secret";
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        if (String(input).endsWith("/web-sessions/exchange"))
          return Response.json({
            data: { access_token: "jwt-server-only", expires_in: 900 },
          });
        expect(String(input)).toBe("http://127.0.0.1:3101/v1/organizations");
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer jwt-server-only"
        );
        return Response.json(
          { data: { organization_id: "org-1" } },
          { status: 201 }
        );
      });

    const response = await createOrganization(
      new Request(`${origin}/api/organizations`, {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: `__Host-aihub_web_session=${"o".repeat(43)}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "9f6a9dd3-80d3-4f2b-a7bf-625a75d0a38a",
        },
        body: JSON.stringify({ name: "Test organization" }),
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      data: { organization_id: "org-1" },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("clears the browser cookie when a protected request and session exchange reject it", async () => {
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          data: { access_token: "jwt-server-only", expires_in: 900 },
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    const response = await authenticatedAihubFetch(
      new Request(`${origin}/api/organizations/me/members`, {
        headers: { "X-Real-IP": "198.51.100.10" },
      }),
      "r".repeat(43),
      "/v1/organizations/me/members"
    );

    expect(response.status).toBe(401);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:3101/v1/auth/web-sessions/exchange",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-AIHUB-End-User-IP": "198.51.100.10",
        }),
      })
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await response.json()).toEqual({
      success: false,
      error: { code: "AUTH_REQUIRED", message: "Sign-in required." },
    });
  });

  it("clears the cookie when the first exchange rejects the Web Session", async () => {
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 401 })
    );

    const response = await authenticatedAihubFetch(
      new Request(`${origin}/api/organizations/me/members`),
      "r".repeat(43),
      "/v1/organizations/me/members"
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("drops expired access tokens instead of keeping every abandoned session", async () => {
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-14T00:00:00Z"));
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({ data: { access_token: "jwt", expires_in: 900 } })
    );
    try {
      const before = cachedWebSessionCount();
      await getCurrentWebSession("x".repeat(43), undefined);
      expect(cachedWebSessionCount()).toBe(before + 1);

      vi.setSystemTime(new Date("2026-10-14T00:16:00Z"));
      await getCurrentWebSession("o".repeat(43), undefined);

      expect(cachedWebSessionCount()).toBe(before + 1);
    } finally {
      vi.useRealTimers();
    }
  });
});
