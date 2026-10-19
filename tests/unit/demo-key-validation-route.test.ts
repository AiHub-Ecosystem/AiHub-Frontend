import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/demo/key/validate/route";

const upstream = vi.fn<typeof fetch>();
const url = "https://customer.test/api/demo/key/validate";
const validBody = JSON.stringify({
  environment: "sandbox",
  scope: "writing.grade",
});

function validationResponse(data: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ data, meta: { request_id: "req_test" } }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

function request(body: BodyInit, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-demo-api-key": "demo-key",
      ...headers,
    },
    body,
  });
}

function streamingRequest(
  body: ReadableStream<Uint8Array>,
  headers: Record<string, string> = {}
) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-demo-api-key": "demo-key",
      ...headers,
    },
    body,
    duplex: "half",
  } as RequestInit);
}

beforeEach(() => {
  upstream.mockResolvedValue(
    new Response(
      JSON.stringify({
        data: {
          valid: true,
          environment: "sandbox",
          scope: "writing.grade",
          user_identity_mode: "declared_id",
          allowance: {
            monthly_limit: 5,
            reserved: 0,
            shared_monthly_limit: 500,
            shared_reserved: 0,
          },
        },
        meta: { request_id: "req_test" },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  );
  vi.stubGlobal("fetch", upstream);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("AIHUB_SANDBOX_BASE_URL", "https://sandbox.aihubproduction.com");
  vi.stubEnv("AIHUB_WEB_SESSION_CLIENT_SECRET", "server-only-secret");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  upstream.mockReset();
});

describe("demo key validation BFF route", () => {
  it("forwards the chosen key with a server secret and the rightmost proxy IP", async () => {
    const response = await POST(
      request(validBody, {
        "x-forwarded-for": "203.0.113.7, 198.51.100.25",
      })
    );

    expect(response.status).toBe(200);
    const init = upstream.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get("x-aihub-client-secret")).toBe("server-only-secret");
    expect(headers.get("x-aihub-visitor-ip")).toBe("198.51.100.25");
  });

  it("preserves upstream status and retry metadata without exposing its message", async () => {
    upstream.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "RATE_LIMITED",
            message: "private backend detail",
            retryable: false,
            retry_after_ms: 1_500,
          },
        }),
        { status: 429, headers: { "content-type": "application/json" } }
      )
    );

    const response = await POST(
      request(validBody, { "x-forwarded-for": "198.51.100.25" })
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: {
        code: "RATE_LIMITED",
        message: "Bạn kiểm tra key quá nhanh. Chờ một chút rồi thử lại.",
        retryable: false,
        retry_after_ms: 1_500,
      },
    });
  });

  it.each([undefined, "unknown_mode"])(
    "rejects a successful validation without a recognized identity mode (%s)",
    async (user_identity_mode) => {
      const data = {
        valid: true,
        environment: "sandbox",
        scope: "writing.grade",
        ...(user_identity_mode === undefined ? {} : { user_identity_mode }),
      };
      upstream.mockResolvedValueOnce(validationResponse(data));

      const response = await POST(
        request(validBody, { "x-forwarded-for": "198.51.100.25" })
      );
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload.error.code).toBe("AI_SERVICE_CONTRACT_VIOLATION");
      expect(payload.error.message).toMatch(/thử lại|hỗ trợ/i);
      expect(payload.data).toBeUndefined();
    }
  );

  it("rejects a declared oversized request before reading the stream", async () => {
    let pulled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulled = true;
          controller.enqueue(new TextEncoder().encode(validBody));
        },
      },
      { highWaterMark: 0 }
    );

    const response = await POST(
      streamingRequest(body, { "content-length": "1025" })
    );

    expect(response.status).toBe(413);
    expect(pulled).toBe(false);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("cancels an unbounded stream as soon as its bytes exceed the limit", async () => {
    let canceled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(1025)));
      },
      cancel() {
        canceled = true;
      },
    });

    const response = await POST(streamingRequest(body));

    expect(response.status).toBe(413);
    expect(canceled).toBe(true);
    expect(upstream).not.toHaveBeenCalled();
  });
});
