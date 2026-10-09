import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";

const appOrigin = "http://localhost:3100";
const sessionId = "a".repeat(43);

function post(path: string, body: unknown, origin: string | null = appOrigin) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (origin) headers.set("Origin", origin);
  return new Request(`http://localhost:3100/api/auth/${path}`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CUSTOMER_WEB_ORIGIN;
  delete process.env.AIHUB_BASE_URL;
});

describe("Password Recovery BFF", () => {
  it.each(["https://attacker.test", null])(
    "rejects foreign or missing Origin before contacting AIHUB (%s)",
    async (origin) => {
      process.env.CUSTOMER_WEB_ORIGIN = appOrigin;
      process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
      const upstreamFetch = vi.spyOn(globalThis, "fetch");

      const response = await forgotPassword(
        post("forgot-password", { email: "user@example.test" }, origin)
      );

      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(upstreamFetch).not.toHaveBeenCalled();
    }
  );

  it("validates email and forwards only the accepted payload", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = appOrigin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    const upstreamFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 202 }));

    const invalid = await forgotPassword(
      post("forgot-password", { email: "" })
    );
    const accepted = await forgotPassword(
      post("forgot-password", {
        email: "user@example.test",
        extra: "not-forwarded",
      })
    );

    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({
      error: { code: "INVALID_REQUEST", fields: ["email"] },
    });
    expect(accepted.status).toBe(202);
    expect(accepted.headers.get("cache-control")).toBe("no-store");
    expect(await accepted.json()).toEqual({ status: "accepted" });
    expect(upstreamFetch).toHaveBeenCalledOnce();
    expect(upstreamFetch.mock.calls[0][0]).toBe(
      "http://127.0.0.1:3101/v1/auth/forgot-password"
    );
    expect(JSON.parse(String(upstreamFetch.mock.calls[0][1]?.body))).toEqual({
      email: "user@example.test",
    });
  });

  it("maps rate limits and temporary failures without a success response", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = appOrigin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "RATE_LIMITED", retry_after_ms: 17_000 } },
          { status: 429 }
        )
      )
      .mockResolvedValueOnce(
        Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 })
      );

    const limited = await forgotPassword(
      post("forgot-password", { email: "user@example.test" })
    );
    const unavailable = await forgotPassword(
      post("forgot-password", { email: "user@example.test" })
    );

    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({
      error: { code: "RATE_LIMITED", retry_after_seconds: 17 },
    });
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({
      error: { code: "UNAVAILABLE" },
    });
  });
});

describe("Password Reset BFF", () => {
  it.each(["https://attacker.test", null])(
    "rejects foreign or missing Origin before contacting AIHUB (%s)",
    async (origin) => {
      process.env.CUSTOMER_WEB_ORIGIN = appOrigin;
      process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
      const upstreamFetch = vi.spyOn(globalThis, "fetch");

      const response = await resetPassword(
        post(
          "reset-password",
          { token: "private-token", password: "valid-password" },
          origin
        )
      );

      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(upstreamFetch).not.toHaveBeenCalled();
    }
  );

  it.each([
    [{ token: "", password: "valid-password" }, ["token"]],
    [{ token: "private-token", password: "short" }, ["password"]],
  ])("rejects invalid reset fields before forwarding", async (body, fields) => {
    process.env.CUSTOMER_WEB_ORIGIN = appOrigin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    const upstreamFetch = vi.spyOn(globalThis, "fetch");

    const response = await resetPassword(post("reset-password", body));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: { code: "INVALID_REQUEST", fields },
    });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("forwards only token and password after validation", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = appOrigin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    const upstreamFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    const response = await resetPassword(
      post("reset-password", {
        token: "private-token",
        password: "valid-password",
        extra: true,
      })
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(upstreamFetch).toHaveBeenCalledOnce();
    expect(JSON.parse(String(upstreamFetch.mock.calls[0][1]?.body))).toEqual({
      token: "private-token",
      password: "valid-password",
    });
  });

  it("clears the current browser cookie after a successful account-wide reset", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = appOrigin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );

    const response = await resetPassword(
      new Request("http://localhost:3100/api/auth/reset-password", {
        method: "POST",
        headers: {
          Origin: appOrigin,
          "Content-Type": "application/json",
          Cookie: `__Host-aihub_web_session=${sessionId}`,
        },
        body: JSON.stringify({
          token: "private-token",
          password: "valid-password",
        }),
      })
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain(
      "__Host-aihub_web_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict"
    );
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("maps invalid tokens to the expired-link code and hides upstream detail", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = appOrigin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          error: {
            code: "AUTH_PASSWORD_RESET_TOKEN_INVALID",
            message: "private",
          },
        },
        { status: 400 }
      )
    );

    const response = await resetPassword(
      post("reset-password", {
        token: "invalid-private-token",
        password: "valid-password",
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "AUTH_PASSWORD_RESET_TOKEN_INVALID" },
    });
  });
});
