import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/login/route";

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
});
