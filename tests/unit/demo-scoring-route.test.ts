import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/demo/scoring/grade/route";
import { gradeWriting, ScoringUpstreamError } from "@/lib/scoring-gateway";

vi.mock("@/lib/scoring-gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scoring-gateway")>();
  return { ...actual, gradeWriting: vi.fn() };
});

const gradeWritingMock = vi.mocked(gradeWriting);

afterEach(() => vi.clearAllMocks());

describe("Writing grading error response", () => {
  it("preserves upstream status and retry metadata without exposing its message", async () => {
    gradeWritingMock.mockRejectedValueOnce(
      new ScoringUpstreamError("CONTRACT_TEST_NEW_ERROR", 429, true, 1_500)
    );

    const response = await POST(
      new Request("http://localhost/api/demo/scoring/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: {
        code: "CONTRACT_TEST_NEW_ERROR",
        message: "Yêu cầu bị AIHUB từ chối.",
        retryable: true,
        retry_after_ms: 1_500,
      },
    });
  });
});
