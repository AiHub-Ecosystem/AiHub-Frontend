import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/verify-email/route";

const origin = "http://localhost:3100";
const oldToken = "o".repeat(43);
const newToken = "n".repeat(43);
const binding = "b".repeat(43);

function verifyRequest(token: unknown, cookie?: string) {
  const headers = new Headers({
    Origin: origin,
    "Content-Type": "application/json",
  });
  if (cookie) headers.set("Cookie", cookie);
  return new Request(`${origin}/api/auth/verify-email`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CUSTOMER_WEB_ORIGIN;
  delete process.env.AIHUB_BASE_URL;
  delete process.env.AIHUB_WEB_SESSION_CLIENT_SECRET;
});

describe("Customer Web email verification BFF", () => {
  it("forwards the verification and binding, replaces the old session, then revokes it", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = origin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    process.env.AIHUB_WEB_SESSION_CLIENT_SECRET = "server-only-secret";
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("X-AIHUB-Client-Secret")).toBe("server-only-secret");
        if (String(input).endsWith("/web-sessions/verification"))
          return Response.json(
            {
              data: {
                web_session_token: newToken,
                expires_at: "2026-11-08T00:00:00.000Z",
              },
            },
            { status: 201 }
          );
        expect(String(input)).toBe(
          "http://127.0.0.1:3101/v1/auth/web-sessions/logout"
        );
        return new Response(null, { status: 204 });
      });

    const response = await POST(
      verifyRequest(
        "opaque-token",
        `__Host-aihub_web_session=${oldToken}; __Host-aihub_signup=${binding}`
      )
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("location")).toBe(`${origin}/console`);
    expect(response.headers.getSetCookie()).toEqual([
      `__Host-aihub_web_session=${newToken}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict`,
      "__Host-aihub_signup=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict",
    ]);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:3101/v1/auth/web-sessions/verification",
      expect.objectContaining({
        body: JSON.stringify({
          token: "opaque-token",
          browser_binding: binding,
        }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:3101/v1/auth/web-sessions/logout",
      expect.objectContaining({
        body: JSON.stringify({ web_session_token: oldToken }),
      })
    );
  });

  it("keeps an existing session when verification has no matching browser binding", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = origin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    process.env.AIHUB_WEB_SESSION_CLIENT_SECRET = "server-only-secret";
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) =>
        String(input).endsWith("/verification")
          ? new Response(null, { status: 204 })
          : Response.json({
              data: { access_token: "server-jwt", expires_in: 900 },
            })
      );

    const response = await POST(
      verifyRequest("opaque-token", `__Host-aihub_web_session=${oldToken}`)
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${origin}/console`);
    expect(response.headers.getSetCookie()).toEqual([
      "__Host-aihub_signup=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict",
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1]?.body).toBe(
      JSON.stringify({ token: "opaque-token" })
    );
  });

  it("preserves the old cookie when the current session cannot be checked", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = origin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    const response = await POST(
      verifyRequest(
        "opaque-token",
        `__Host-aihub_web_session=${"q".repeat(43)}`
      )
    );

    expect(response.status).toBe(503);
    expect(response.headers.getSetCookie()).toEqual([
      "__Host-aihub_signup=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict",
    ]);
    expect(await response.json()).toEqual({ error: { code: "UNAVAILABLE" } });
  });

  it("sends a browser without a valid session to login after verify-only", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = origin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );

    const response = await POST(verifyRequest("opaque-token"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${origin}/login?verified=1`);
    expect(response.headers.get("set-cookie")).toContain(
      "__Host-aihub_signup=; Path=/; Max-Age=0"
    );
  });

  it.each(["", "x".repeat(513), null])(
    "rejects missing or out-of-range token (%s) without contacting AIHUB",
    async (token) => {
      process.env.CUSTOMER_WEB_ORIGIN = origin;
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
    process.env.CUSTOMER_WEB_ORIGIN = origin;
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
