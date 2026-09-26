import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import * as authSession from "@/lib/auth-session";

const request = (
  values: Record<string, string>,
  origin: string | null = "http://localhost:3100"
) => {
  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded",
  });
  if (origin) headers.set("Origin", origin);
  return new Request("http://localhost:3100/api/auth/login", {
    method: "POST",
    headers,
    body: new URLSearchParams(values),
  });
};

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CUSTOMER_WEB_ORIGIN;
  delete process.env.AIHUB_BASE_URL;
  delete process.env.REDIS_URL;
});

describe("Customer Web sign-in BFF", () => {
  it.each(["https://attacker.test", null])(
    "rejects foreign or missing Origin (%s) before contacting AIHUB",
    async (origin) => {
      process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
      const fetch = vi.spyOn(globalThis, "fetch");

      const response = await POST(
        request({ email: "user@example.com", password: "secret" }, origin)
      );

      expect(response.status).toBe(403);
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it("maps rejected credentials to the same safe sign-in error", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json(
          { error: { code: "AUTH_CREDENTIALS_INVALID" } },
          { status: 401 }
        )
      );

    const response = await POST(
      request({ email: "user@example.com", password: "wrong" })
    );

    expect(response.status).toBe(303);
    expect(
      new URL(response.headers.get("location")!).searchParams.get("error")
    ).toBe("invalid");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("returns Lab sign-in errors to the Lab form", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { error: { code: "AUTH_CREDENTIALS_INVALID" } },
        { status: 401 }
      )
    );

    const response = await POST(
      request({
        email: "user@example.com",
        password: "wrong",
        next: "/console",
        return_to: "/lab",
      })
    );
    const location = new URL(response.headers.get("location")!);

    expect(location.pathname).toBe("/lab");
    expect(location.searchParams.get("error")).toBe("invalid");
    expect(location.searchParams.get("next")).toBe("/console");
  });

  it("includes a bounded retry delay for rate limited credentials", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 429, headers: { "Retry-After": "30" } })
    );

    const response = await POST(
      request({ email: "user@example.com", password: "secret" })
    );
    const location = new URL(response.headers.get("location")!);

    expect(location.searchParams.get("error")).toBe("rate-limited");
    expect(location.searchParams.get("retry")).toBe("30");
  });

  it.each([
    ["/console?tab=keys", "http://localhost:3100/console?tab=keys"],
    ["https://attacker.test/collect", "http://localhost:3100/console"],
  ])(
    "sets a protected Web Session cookie and safely routes next=%s",
    async (next, expected) => {
      process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
      process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
      const sessionId = "a".repeat(43);
      vi.spyOn(
        authSession,
        "createWebSessionFromAihubResponse"
      ).mockResolvedValue({ sessionId, refreshToken: "refresh-secret" });
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { access_token: "server-only-token", expires_in: 900 },
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie":
                "__Host-aihub_refresh=refresh-secret; Path=/; Secure; HttpOnly; SameSite=Strict",
            },
          }
        )
      );

      const response = await POST(
        request({ email: "user@example.com", password: "secret", next })
      );
      const cookie = response.headers.get("set-cookie")!;

      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(expected);
      expect(cookie).toContain(`__Host-aihub_web_session=${sessionId}`);
      expect(cookie).toContain(
        "Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict"
      );
      expect(cookie).not.toContain("refresh-secret");
    }
  );

  it("clears the local cookie and tries upstream logout during an outage", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    const sessionId = "a".repeat(43);
    vi.spyOn(authSession, "getWebSession").mockResolvedValue({
      accessToken: "server-only-token",
      accessTokenExpiresAt: Date.now() + 60_000,
      refreshToken: "refresh-secret",
    });
    const deleteSession = vi
      .spyOn(authSession, "deleteWebSession")
      .mockResolvedValue();
    const logoutUpstream = vi
      .spyOn(authSession, "logoutFromAihub")
      .mockRejectedValue(new Error("AIHUB unavailable"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await logout(
      new Request("http://localhost:3100/api/auth/logout", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3100",
          Cookie: `__Host-aihub_web_session=${sessionId}`,
        },
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3100/");
    expect(response.headers.get("set-cookie")).toContain(
      "Max-Age=0; HttpOnly; Secure; SameSite=Strict"
    );
    expect(deleteSession).toHaveBeenCalledWith(sessionId);
    expect(logoutUpstream).toHaveBeenCalledWith("refresh-secret");
  });
});
