import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDemoBaseUrl,
  gradeSpeaking,
  gradeSpeakingByUrl,
  parseSpeakingJsonRequest,
  parseSpeakingRequest,
  SpeakingBoundaryError,
} from "@/lib/speaking-gateway";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const APPROVED_AUDIO_URL =
  "https://s3.wispace.app/audio/answer.wav?signature=demo";

function jsonRequest(body: unknown) {
  return new Request("http://127.0.0.1/api/demo/speaking/grading-json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1",
      "X-Demo-Api-Key": "sandbox-test-key",
      "X-Demo-Environment": "sandbox",
      "X-Demo-User-Identity": "00000000-0000-4000-8000-000000000001",
    },
    body: JSON.stringify(body),
  });
}

function baseSpeakingRequest(overrides: Record<string, unknown> = {}) {
  return {
    audio_url: APPROVED_AUDIO_URL,
    part: 1,
    question_id: "p1_hometown",
    ...overrides,
  };
}

/** The demo must not merely parse a widened field, it must forward it. */
function stubUpstream() {
  const sent: string[] = [];
  // The sandbox host is pinned; fetch is stubbed so nothing leaves the test.
  vi.stubEnv("AIHUB_SANDBOX_BASE_URL", "https://sandbox.aihubproduction.com");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const body = init?.body;
      sent.push(
        body instanceof FormData
          ? JSON.stringify([...body.entries()].map(([k, v]) => [k, String(v)]))
          : String(body ?? "")
      );
      if (String(url).includes("/v1/sandbox/assertions")) {
        return new Response(
          JSON.stringify({ data: { assertion: "assertion.jwt" } }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({ data: { question_id: "p1_hometown" }, meta: {} }),
        { status: 200 }
      );
    })
  );
  return sent;
}

describe("Speaking JSON request", () => {
  it("accepts every field the AIHUB contract accepts", async () => {
    const parsed = await parseSpeakingJsonRequest(
      jsonRequest(
        baseSpeakingRequest({
          prompt_text: "Do you enjoy living in your hometown?",
          test_type: "Full-test",
          test_code: "ielts-full-01",
          transcript: "I live in a small town.",
        })
      )
    );

    expect(parsed).toMatchObject({
      testType: "Full-test",
      testCode: "ielts-full-01",
      transcript: "I live in a small town.",
    });
  });

  it("defaults the test type upstream, not in the parser", async () => {
    const sent = stubUpstream();

    // The stub response is not a full envelope; only the sent body matters.
    await gradeSpeakingByUrl(
      jsonRequest(baseSpeakingRequest()),
      "req_test"
    ).catch(() => undefined);

    expect(JSON.parse(sent.at(-1) ?? "{}")).toMatchObject({
      test_type: "Practice",
    });
  });

  it("forwards the widened fields upstream instead of dropping them", async () => {
    const sent = stubUpstream();

    await gradeSpeakingByUrl(
      jsonRequest(
        baseSpeakingRequest({
          test_type: "Full-test",
          test_code: "ielts-full-01",
          transcript: "I live in a small town.",
        })
      ),
      "req_test"
    ).catch(() => undefined);

    expect(JSON.parse(sent.at(-1) ?? "{}")).toMatchObject({
      test_type: "Full-test",
      test_code: "ielts-full-01",
      transcript: "I live in a small town.",
    });
  });

  it("rejects a test type the contract does not define", async () => {
    await expect(
      parseSpeakingJsonRequest(
        jsonRequest(baseSpeakingRequest({ test_type: "Mock" }))
      )
    ).rejects.toThrow(SpeakingBoundaryError);
  });

  it("accepts a question id longer than 256 characters", async () => {
    const parsed = await parseSpeakingJsonRequest(
      jsonRequest(baseSpeakingRequest({ question_id: "p".repeat(400) }))
    );

    expect(parsed.questionId).toHaveLength(400);
  });

  it("still rejects a field the contract does not define", async () => {
    await expect(
      parseSpeakingJsonRequest(
        jsonRequest(baseSpeakingRequest({ learner_id: "42" }))
      )
    ).rejects.toThrow(SpeakingBoundaryError);
  });
});

describe("Speaking multipart request", () => {
  function multipartRequest(entries: Record<string, string>) {
    const form = new FormData();
    form.append(
      "audio",
      new File([new Uint8Array(512)], "answer.wav", { type: "audio/wav" }),
      "answer.wav"
    );
    for (const [name, value] of Object.entries(entries)) {
      form.append(name, value);
    }
    return new Request("http://127.0.0.1/api/demo/speaking/grading", {
      method: "POST",
      headers: {
        Origin: "http://127.0.0.1",
        "X-Demo-Api-Key": "sandbox-test-key",
        "X-Demo-Environment": "sandbox",
        "X-Demo-User-Identity": "00000000-0000-4000-8000-000000000001",
      },
      body: form,
    });
  }

  it("accepts the fields the multipart contract accepts", async () => {
    const parsed = await parseSpeakingRequest(
      multipartRequest({
        part: "1",
        question_id: "p1_hometown",
        prompt_text: "Do you enjoy living in your hometown?",
        test_type: "Full-test",
        test_code: "ielts-full-01",
        transcript: "I live in a small town.",
      })
    );

    expect(parsed).toMatchObject({
      testType: "Full-test",
      testCode: "ielts-full-01",
      transcript: "I live in a small town.",
    });
  });

  it("accepts a question id longer than 256 characters", async () => {
    const parsed = await parseSpeakingRequest(
      multipartRequest({ part: "1", question_id: "p".repeat(400) })
    );

    expect(parsed.questionId).toHaveLength(400);
  });

  it("rejects a test type the contract does not define", async () => {
    await expect(
      parseSpeakingRequest(
        multipartRequest({
          part: "1",
          question_id: "p1_hometown",
          test_type: "Mock",
        })
      )
    ).rejects.toThrow(SpeakingBoundaryError);
  });

  it("rejects a field the contract does not define", async () => {
    await expect(
      parseSpeakingRequest(
        multipartRequest({
          part: "1",
          question_id: "p1_hometown",
          learner_id: "42",
        })
      )
    ).rejects.toThrow(SpeakingBoundaryError);
  });

  it("forwards the widened fields upstream instead of dropping them", async () => {
    const sent = stubUpstream();

    await gradeSpeaking(
      multipartRequest({
        part: "1",
        question_id: "p1_hometown",
        test_type: "Full-test",
        test_code: "ielts-full-01",
        transcript: "I live in a small town.",
      }),
      "req_test"
    ).catch(() => undefined);

    const forwarded = sent.at(-1) ?? "";
    expect(forwarded).toContain("Full-test");
    expect(forwarded).toContain("ielts-full-01");
    expect(forwarded).toContain("I live in a small town.");
  });
});

describe("Speaking demo host", () => {
  it("allows the explicitly configured loopback mock only in development", () => {
    const mockUrl = "http://127.0.0.1:3101";
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AIHUB_SANDBOX_BASE_URL", mockUrl);
    vi.stubEnv("AIHUB_SANDBOX_E2E_MOCK_BASE_URL", mockUrl);

    expect(getDemoBaseUrl("sandbox")).toBe(mockUrl);

    vi.stubEnv("NODE_ENV", "production");
    expect(() => getDemoBaseUrl("sandbox")).toThrow(SpeakingBoundaryError);

    const sandboxUrl = "https://sandbox.aihubproduction.com";
    vi.stubEnv("AIHUB_SANDBOX_BASE_URL", sandboxUrl);
    expect(getDemoBaseUrl("sandbox")).toBe(sandboxUrl);
  });

  it("rejects an unconfigured loopback target", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AIHUB_SANDBOX_BASE_URL", "http://127.0.0.1:3101");
    vi.stubEnv("AIHUB_SANDBOX_E2E_MOCK_BASE_URL", "http://127.0.0.1:3102");

    expect(() => getDemoBaseUrl("sandbox")).toThrow(SpeakingBoundaryError);
  });

  it("sends Production only to the Production host", () => {
    vi.stubEnv("AIHUB_SANDBOX_BASE_URL", "https://sandbox.aihubproduction.com");
    vi.stubEnv("AIHUB_PRODUCTION_BASE_URL", "https://api.aihubproduction.com");

    expect(getDemoBaseUrl("production")).toBe(
      "https://api.aihubproduction.com"
    );
  });

  it("refuses an environment it does not name", () => {
    expect(() => getDemoBaseUrl("staging")).toThrow(SpeakingBoundaryError);
  });
});
