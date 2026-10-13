import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";

const request = (
  values: Record<string, string>,
  origin: string | null = "http://localhost:3100",
  extraHeaders: Record<string, string> = {}
) => {
  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded",
  });
  if (origin) headers.set("Origin", origin);
  for (const [name, value] of Object.entries(extraHeaders))
    headers.set(name, value);
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
  delete process.env.AIHUB_WEB_SESSION_CLIENT_SECRET;
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
      process.env.AIHUB_WEB_SESSION_CLIENT_SECRET = "server-only-secret";
      const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        Response.json(
          {
            data: {
              web_session_token: sessionId,
              expires_at: "2026-11-08T00:00:00.000Z",
            },
            meta: { request_id: "req-test" },
          },
          { status: 201 }
        )
      );

      const response = await POST(
        request(
          { email: "user@example.com", password: "secret", next },
          "http://localhost:3100",
          {
            "X-Real-IP": "198.51.100.10",
            "X-AIHUB-End-User-IP": "192.0.2.99",
          }
        )
      );
      const cookie = response.headers.get("set-cookie")!;

      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(expected);
      expect(cookie).toContain(`__Host-aihub_web_session=${sessionId}`);
      expect(cookie).toContain(
        "Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict"
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:3101/v1/auth/web-sessions",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-AIHUB-Client-Secret": "server-only-secret",
            "X-AIHUB-End-User-IP": "198.51.100.10",
          },
          body: JSON.stringify({
            email: "user@example.com",
            password: "secret",
          }),
          cache: "no-store",
        })
      );
      expect(cookie).not.toContain("server-only-secret");
    }
  );

  it("clears the local cookie and tries upstream logout during an outage", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    const sessionId = "a".repeat(43);
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    process.env.AIHUB_WEB_SESSION_CLIENT_SECRET = "server-only-secret";
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("AIHUB unavailable"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await logout(
      new Request("http://localhost:3100/api/auth/logout", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3100",
          Cookie: `__Host-aihub_web_session=${sessionId}`,
          "X-Real-IP": "198.51.100.10",
        },
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3100/");
    expect(response.headers.get("set-cookie")).toContain(
      "Max-Age=0; HttpOnly; Secure; SameSite=Strict"
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3101/v1/auth/web-sessions/logout",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AIHUB-Client-Secret": "server-only-secret",
          "X-AIHUB-End-User-IP": "198.51.100.10",
        },
        body: JSON.stringify({ web_session_token: sessionId }),
      })
    );
  });

  it("returns the browser logout response before remote revocation completes", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    process.env.AIHUB_WEB_SESSION_CLIENT_SECRET = "server-only-secret";
    let remoteFinished = false;
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      remoteFinished = true;
      return new Response(null, { status: 204 });
    });

    const response = await logout(
      new Request("http://localhost:3100/api/auth/logout", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3100",
          Cookie: `__Host-aihub_web_session=${"z".repeat(43)}`,
        },
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(remoteFinished).toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
