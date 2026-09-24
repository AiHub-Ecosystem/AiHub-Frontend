import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/register/route";

const values = {
  email: "new@example.test",
  username: "new-user",
  password: "correct horse battery staple",
};

function registrationRequest(body: unknown = values) {
  return new Request("http://localhost:3100/api/auth/register", {
    method: "POST",
    headers: {
      Origin: "http://localhost:3100",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CUSTOMER_WEB_ORIGIN;
  delete process.env.AIHUB_BASE_URL;
});

describe("Customer Web registration BFF", () => {
  it("creates a pending User Account through AIHUB without signing in", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    const upstreamFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          data: {
            email: values.email,
            username: values.username,
            status: "pending_verification",
          },
        },
        { status: 201 }
      )
    );

    const response = await POST(registrationRequest());

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({
      status: "pending_verification",
    });
    expect(upstreamFetch).toHaveBeenCalledOnce();
    expect(upstreamFetch.mock.calls[0][0]).toBe(
      "http://127.0.0.1:3101/v1/auth/register"
    );
    expect(JSON.parse(String(upstreamFetch.mock.calls[0][1]?.body))).toEqual(
      values
    );
  });

  it("rejects a Username outside the AIHUB contract before calling AIHUB", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    const upstreamFetch = vi.spyOn(globalThis, "fetch");

    const response = await POST(
      registrationRequest({ ...values, username: "u".repeat(65) })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "INVALID_REQUEST", fields: ["username"] },
    });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("maps duplicate email or Username without exposing upstream details", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          error: {
            code: "AUTH_IDENTITY_UNAVAILABLE",
            message: "private provider detail",
          },
        },
        { status: 409 }
      )
    );

    const response = await POST(registrationRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "AUTH_IDENTITY_UNAVAILABLE" },
    });
  });
});
