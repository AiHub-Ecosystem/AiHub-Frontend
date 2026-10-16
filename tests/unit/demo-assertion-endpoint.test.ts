import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchDemoAssertion,
  isDemoAssertionEndpointUrl,
} from "@/lib/demo-assertion-endpoint";

const fixedNow = new Date("2026-10-16T12:00:00.000Z");
const nowSeconds = Math.floor(fixedNow.getTime() / 1000);
const endpoint = "https://customer.example.test/demo/assertion";

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(fixedNow.getTime());
});

function base64Url(value: string) {
  return btoa(value).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function assertion(exp = nowSeconds + 300) {
  return [
    base64Url(JSON.stringify({ alg: "RS256", kid: "demo" })),
    base64Url(JSON.stringify({ exp, sub: "demo-user" })),
    base64Url("signature"),
  ].join(".");
}

function response(
  body: unknown,
  { status = 200, cacheControl = "no-store" } = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": cacheControl,
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("customer demo assertion endpoint", () => {
  it.each([
    "http://customer.example.test/assertion",
    "/relative/assertion",
    "https://user:password@customer.example.test/assertion",
    "https://@customer.example.test/assertion",
    "https://customer.example.test/assertion?token=secret",
    "https://customer.example.test/assertion#fragment",
    "https://customer.example.test/assertion?",
    "https://customer.example.test/assertion#",
  ])("rejects unsafe endpoint URL %s", (url) => {
    expect(isDemoAssertionEndpointUrl(url)).toBe(false);
  });

  it("accepts an absolute HTTPS endpoint without URL credentials or suffixes", () => {
    expect(isDemoAssertionEndpointUrl(endpoint)).toBe(true);
  });

  it("requests a fresh assertion without sending credentials or a body", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        assertion: assertion(),
        expires_at: new Date((nowSeconds + 300) * 1000).toISOString(),
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchDemoAssertion(endpoint)).resolves.toBe(assertion());
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(endpoint);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();
    expect(init?.credentials).toBe("omit");
    expect(init?.mode).toBe("cors");
    expect(init?.redirect).toBe("error");
    expect(init?.cache).toBe("no-store");
    expect(new Headers(init?.headers).get("accept")).toBe("application/json");
    expect(new Headers(init?.headers).get("authorization")).toBeNull();
    expect(new Headers(init?.headers).get("x-api-key")).toBeNull();
  });

  it("does not send a request to an invalid endpoint URL", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchDemoAssertion("http://customer.example.test/assertion")
    ).rejects.toThrow(
      "Không thể lấy assertion hợp lệ. Hãy kiểm tra endpoint rồi thử lại."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed, expired, mismatched, and oversized assertions", async () => {
    const cases = [
      {
        body: {
          assertion: "not-a-jwt",
          expires_at: new Date((nowSeconds + 300) * 1000).toISOString(),
        },
        label: "malformed JWT",
      },
      {
        body: {
          assertion: assertion(nowSeconds - 1),
          expires_at: new Date((nowSeconds - 1) * 1000).toISOString(),
        },
        label: "expired JWT",
      },
      {
        body: {
          assertion: assertion(),
          expires_at: new Date((nowSeconds + 301) * 1000).toISOString(),
        },
        label: "expiry mismatch",
      },
      {
        body: {
          assertion: "a".repeat(6 * 1024 + 1),
          expires_at: new Date((nowSeconds + 300) * 1000).toISOString(),
        },
        label: "oversized assertion",
      },
    ];

    for (const item of cases) {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockResolvedValue(response(item.body))
      );
      await expect(fetchDemoAssertion(endpoint), item.label).rejects.toThrow(
        "Không thể lấy assertion hợp lệ. Hãy kiểm tra endpoint rồi thử lại."
      );
    }
  });

  it("requires the endpoint response to prohibit caching", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        response(
          {
            assertion: assertion(),
            expires_at: new Date((nowSeconds + 300) * 1000).toISOString(),
          },
          { cacheControl: "private, max-age=60" }
        )
      )
    );

    await expect(fetchDemoAssertion(endpoint)).rejects.toThrow(
      "Không thể lấy assertion hợp lệ. Hãy kiểm tra endpoint rồi thử lại."
    );
  });

  it("rejects an oversized endpoint response before parsing its JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(`{"padding":"${"x".repeat(8 * 1024)}"}`, {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        })
      )
    );

    await expect(fetchDemoAssertion(endpoint)).rejects.toThrow(
      "Không thể lấy assertion hợp lệ. Hãy kiểm tra endpoint rồi thử lại."
    );
  });

  it("maps stable endpoint error codes to safe guidance", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          response(
            { error: { code: "RATE_LIMITED", message: "raw secret" } },
            { status: 429 }
          )
        )
    );

    await expect(fetchDemoAssertion(endpoint)).rejects.toThrow(
      "Endpoint đang giới hạn số yêu cầu. Vui lòng đợi rồi thử lại."
    );

    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          response(
            { error: { code: "ISSUER_ERROR", message: "raw secret" } },
            { status: 502 }
          )
        )
    );
    await expect(fetchDemoAssertion(endpoint)).rejects.toThrow(
      "Máy chủ cấp assertion gặp lỗi"
    );

    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          response(
            { error: { code: "TEST_USER_UNAVAILABLE", message: "raw secret" } },
            { status: 503 }
          )
        )
    );
    await expect(fetchDemoAssertion(endpoint)).rejects.toThrow(
      "Người dùng demo chưa sẵn sàng"
    );
  });

  it("uses generic guidance when a known error code has an unexpected status", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          response(
            { error: { code: "RATE_LIMITED", message: "raw secret" } },
            { status: 503 }
          )
        )
    );

    await expect(fetchDemoAssertion(endpoint)).rejects.toThrow(
      "Không thể lấy assertion hợp lệ. Hãy kiểm tra endpoint rồi thử lại."
    );
  });

  it("uses generic safe guidance for unknown errors and network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          response(
            { error: { code: "UNKNOWN", message: "raw secret" } },
            { status: 503 }
          )
        )
    );
    await expect(fetchDemoAssertion(endpoint)).rejects.toThrow(
      "Không thể lấy assertion hợp lệ. Hãy kiểm tra endpoint rồi thử lại."
    );

    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new Error("raw secret"))
    );
    await expect(fetchDemoAssertion(endpoint)).rejects.toThrow(
      "Không thể lấy assertion hợp lệ. Hãy kiểm tra endpoint rồi thử lại."
    );
  });
});
