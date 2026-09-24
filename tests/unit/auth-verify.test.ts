import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/verify-email/route";

function verifyRequest(token: unknown) {
  return new Request("http://localhost:3100/api/auth/verify-email", {
    method: "POST",
    headers: {
      Origin: "http://localhost:3100",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CUSTOMER_WEB_ORIGIN;
  delete process.env.AIHUB_BASE_URL;
});

describe("Customer Web email verification BFF", () => {
  it("forwards the verification token server-side and returns no-store 204", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    const response = await POST(verifyRequest("opaque-token"));

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3101/v1/auth/verify-email",
      expect.objectContaining({
        body: JSON.stringify({ token: "opaque-token" }),
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
