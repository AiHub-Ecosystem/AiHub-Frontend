import { describe, expect, it } from "vitest";
import { errorFromPayload, toneFor } from "@/app/demo/scoring/scoring-client";

describe("errorFromPayload", () => {
  it("keeps code and retry hints without rendering the raw upstream message", () => {
    expect(
      errorFromPayload({
        error: {
          code: "RATE_LIMITED",
          message: "quota exhausted for org 7",
          retryable: true,
          retry_after_ms: 2000,
        },
      })
    ).toEqual({
      code: "RATE_LIMITED",
      message: "Bạn gửi hơi nhanh. Chờ một chút rồi thử lại.",
      retryable: true,
      retry_after_ms: 2000,
    });
  });

  it("uses a safe generic message for an unknown code without exposing backend text", () => {
    expect(
      errorFromPayload({
        error: { code: "SOMETHING_NEW_UPSTREAM", message: "internal db host" },
      })
    ).toMatchObject({
      code: "SOMETHING_NEW_UPSTREAM",
      message: "Yêu cầu bị AIHUB từ chối.",
    });
  });

  it("falls back when the error has no message", () => {
    expect(errorFromPayload({ error: { code: "RATE_LIMITED" } })).toMatchObject(
      { code: "AI_SERVICE_UNAVAILABLE" }
    );
  });

  it("falls back when the payload is not an object", () => {
    expect(errorFromPayload(null)).toMatchObject({
      code: "AI_SERVICE_UNAVAILABLE",
    });
    expect(errorFromPayload("503 Service Unavailable")).toMatchObject({
      code: "AI_SERVICE_UNAVAILABLE",
    });
  });

  it("falls back when the payload carries no error key", () => {
    expect(
      errorFromPayload({ code: "RATE_LIMITED", message: "quota exhausted" })
    ).toMatchObject({ code: "AI_SERVICE_UNAVAILABLE" });
  });

  it("drops retry fields whose types are wrong rather than passing them on", () => {
    const parsed = errorFromPayload({
      error: {
        code: "RATE_LIMITED",
        message: "quota exhausted",
        retryable: "yes",
        retry_after_ms: "2000",
      },
    });

    expect(parsed).not.toHaveProperty("retryable");
    expect(parsed).not.toHaveProperty("retry_after_ms");
  });
});

describe("toneFor", () => {
  it("gives Task Achievement its own tone", () => {
    expect(toneFor("task_achievement")).toBe("achieve");
  });

  it("gives Coherence & Cohesion its own tone", () => {
    expect(toneFor("coherence_cohesion")).toBe("coherence");
  });

  it("gives Lexical Resource its own tone", () => {
    expect(toneFor("lexical_resource")).toBe("lexical");
  });

  it("gives Grammatical Range & Accuracy its own tone", () => {
    expect(toneFor("grammatical_range_accuracy")).toBe("grammar");
  });

  it("gives Task Response the same tone as Task Achievement", () => {
    // Same rubric slot on Task 2, so the badge must not read as a fifth colour.
    expect(toneFor("task_response")).toBe(toneFor("task_achievement"));
  });

  it("falls back to the first tone for an unknown criterion id", () => {
    expect(toneFor("pronunciation")).toBe("achieve");
  });
});
