import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleWritingChartUpload } from "@/lib/scoring-chart-upload";

const ASSET_ID = "chart_01J00000000000000000000001";

function request(
  path: string,
  body?: unknown,
  overrides: Record<string, string> = {}
) {
  return new Request(`http://127.0.0.1${path}`, {
    method: "POST",
    headers: {
      origin: "http://127.0.0.1",
      "content-type": "application/json",
      "x-demo-api-key": "server-side-test-key",
      "x-demo-environment": "sandbox",
      "x-demo-user-identity": "learner-42",
      ...overrides,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const grant = {
  data: {
    asset_id: ASSET_ID,
    upload_url: "https://s3.wispace.app/private/signed-put",
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    expires_at: "2026-10-14T00:05:00.000Z",
    intent_expires_at: "2026-10-14T01:00:00.000Z",
  },
  meta: { request_id: "req_01J00000000000000000000001" },
};

describe("Writing chart upload BFF", () => {
  const originalBaseUrl = process.env.AIHUB_SANDBOX_BASE_URL;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.AIHUB_SANDBOX_BASE_URL = "https://sandbox.aihubproduction.com";
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.restoreAllMocks();
    if (originalBaseUrl === undefined)
      delete process.env.AIHUB_SANDBOX_BASE_URL;
    else process.env.AIHUB_SANDBOX_BASE_URL = originalBaseUrl;
  });

  it("forwards a validated create request to the selected host with server-held credentials", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(grant), { status: 201 })
    );
    const response = await handleWritingChartUpload(
      request("/api/demo/scoring/chart-uploads", {
        content_type: "image/png",
        byte_size: 36,
      }),
      "create"
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(grant);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://sandbox.aihubproduction.com/v1/ielts/writing/task1/chart-uploads",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        redirect: "error",
        body: JSON.stringify({ content_type: "image/png", byte_size: 36 }),
        headers: expect.objectContaining({
          "X-API-Key": "server-side-test-key",
          "X-User-Identity": "learner-42",
        }),
      })
    );
    expect(JSON.stringify(grant)).not.toContain("server-side-test-key");
  });

  it("keeps the existing tier pinned for refresh and completion", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(grant), { status: 200 })
    );
    const refresh = await handleWritingChartUpload(
      request("/api/demo/scoring/chart-uploads"),
      "refresh",
      ASSET_ID
    );
    expect(refresh.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      `https://sandbox.aihubproduction.com/v1/ielts/writing/task1/chart-uploads/${ASSET_ID}/refresh`,
      expect.anything()
    );
  });

  it("rejects cross-origin, unsupported, and oversized requests before forwarding", async () => {
    const crossOrigin = await handleWritingChartUpload(
      request(
        "/api/demo/scoring/chart-uploads",
        { content_type: "image/png", byte_size: 36 },
        { origin: "https://attacker.example" }
      ),
      "create"
    );
    expect(crossOrigin.status).toBe(400);

    const unsupported = await handleWritingChartUpload(
      request("/api/demo/scoring/chart-uploads", {
        content_type: "image/svg+xml",
        byte_size: 36,
      }),
      "create"
    );
    expect(unsupported.status).toBe(400);

    const oversized = await handleWritingChartUpload(
      request("/api/demo/scoring/chart-uploads", {
        content_type: "image/png",
        byte_size: 10 * 1024 * 1024 + 1,
      }),
      "create"
    );
    expect(oversized.status).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps upstream errors to safe messages and rejects malformed success payloads", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "FORBIDDEN", message: "internal secret" },
        }),
        { status: 403 }
      )
    );
    const denied = await handleWritingChartUpload(
      request("/api/demo/scoring/chart-uploads", {
        content_type: "image/png",
        byte_size: 36,
      }),
      "create"
    );
    const deniedBody = await denied.text();
    expect(denied.status).toBe(403);
    expect(deniedBody).toContain("writing.grade");
    expect(deniedBody).not.toContain("internal secret");

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 201 })
    );
    const invalid = await handleWritingChartUpload(
      request("/api/demo/scoring/chart-uploads", {
        content_type: "image/png",
        byte_size: 36,
      }),
      "create"
    );
    expect(invalid.status).toBe(502);
  });
});
