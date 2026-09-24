import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/resend-verification/route";

function resendRequest(email: string) {
  return new Request("http://localhost:3100/api/auth/resend-verification", {
    method: "POST",
    headers: {
      Origin: "http://localhost:3100",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CUSTOMER_WEB_ORIGIN;
  delete process.env.AIHUB_BASE_URL;
});

describe("Customer Web verification resend BFF", () => {
  it("returns the same generic confirmation for any email address", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    const upstreamFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 202 }));

    const knownAddress = await POST(resendRequest("known@example.test"));
    const unknownAddress = await POST(resendRequest("unknown@example.test"));

    expect(knownAddress.status).toBe(202);
    expect(unknownAddress.status).toBe(202);
    expect(knownAddress.headers.get("cache-control")).toBe("no-store");
    expect(await knownAddress.json()).toEqual({ status: "accepted" });
    expect(await unknownAddress.json()).toEqual({ status: "accepted" });
    expect(upstreamFetch).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed email values before contacting AIHUB", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    const upstreamFetch = vi.spyOn(globalThis, "fetch");

    const response = await POST(resendRequest(""));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "INVALID_REQUEST", fields: ["email"] },
    });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("returns a bounded retry delay and no upstream error detail", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { error: { code: "RATE_LIMITED", retry_after_ms: 17_000 } },
        { status: 429 }
      )
    );

    const response = await POST(resendRequest("user@example.test"));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: { code: "RATE_LIMITED", retry_after_seconds: 17 },
    });
  });
});
