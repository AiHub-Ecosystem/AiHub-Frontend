import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDemoBaseUrl,
  gradeSpeaking,
  gradeSpeakingByUrl,
  parseSpeakingJsonRequest,
  parseSpeakingRequest,
  SpeakingBoundaryError,
} from "@/lib/speaking-gateway";
import { POST as postSpeakingJson } from "@/app/api/demo/speaking/grading-json/route";
import { POST as postSpeakingMultipart } from "@/app/api/demo/speaking/grading/route";
import { MAX_SPEAKING_BYTES } from "@/data/speaking-contract";

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

function streamingRequest(
  path: string,
  body: ReadableStream<Uint8Array>,
  contentType: string,
  headers: Record<string, string> = {}
) {
  return new Request(`http://127.0.0.1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Origin: "http://127.0.0.1",
      "X-Demo-Api-Key": "sandbox-test-key",
      "X-Demo-Environment": "sandbox",
      "X-Demo-User-Identity": "00000000-0000-4000-8000-000000000001",
      ...headers,
    },
    body,
    duplex: "half",
  } as RequestInit);
}

function oversizedStream(limit: number) {
  const chunkSize = 64 * 1024;
  let remaining = limit + chunkSize;
  let canceled = false;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (remaining === 0) {
          controller.close();
          return;
        }
        const size = Math.min(chunkSize, remaining);
        remaining -= size;
        controller.enqueue(new Uint8Array(size));
      },
      cancel() {
        canceled = true;
      },
    },
    { highWaterMark: 0 }
  );
  return { body, wasCanceled: () => canceled };
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
  const sentHeaders: Headers[] = [];
  // The sandbox host is pinned; fetch is stubbed so nothing leaves the test.
  vi.stubEnv("AIHUB_SANDBOX_BASE_URL", "https://sandbox.aihubproduction.com");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      sentHeaders.push(new Headers(init?.headers));
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
  return { sent, sentHeaders };
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
    const { sent } = stubUpstream();

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
    const { sent } = stubUpstream();

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

  it("bounds a streamed JSON body with no Content-Length before forwarding", async () => {
    const { sent } = stubUpstream();
    const stream = oversizedStream(256 * 1024);

    const response = await postSpeakingJson(
      streamingRequest(
        "/api/demo/speaking/grading-json",
        stream.body,
        "application/json"
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(stream.wasCanceled()).toBe(true);
    expect(sent).toHaveLength(0);
  });

  it("accepts a valid JSON request exactly at the 256 KB limit", async () => {
    const body: Record<string, unknown> = baseSpeakingRequest({
      question_id: "q".repeat(64 * 1024),
      prompt_text: "p".repeat(64 * 1024),
      test_code: "c".repeat(64 * 1024),
      transcript: "",
    });
    const bodyWithoutTranscript = JSON.stringify(body);
    body.transcript = "t".repeat(
      256 * 1024 - new TextEncoder().encode(bodyWithoutTranscript).byteLength
    );
    const serialized = JSON.stringify(body);

    expect(new TextEncoder().encode(serialized).byteLength).toBe(256 * 1024);
    await expect(
      parseSpeakingJsonRequest(jsonRequest(body))
    ).resolves.toMatchObject({
      part: 1,
      questionId: body.question_id,
      transcript: body.transcript,
    });
  });

  it("forwards the visitor's declared identity unchanged", async () => {
    const { sentHeaders } = stubUpstream();
    const request = jsonRequest(baseSpeakingRequest());
    const headers = new Headers(request.headers);
    headers.set("X-Demo-User-Identity", "customer_42");
    const customizedRequest = new Request(request, { headers });

    await gradeSpeakingByUrl(customizedRequest, "req_test").catch(
      () => undefined
    );

    expect(sentHeaders.at(-1)?.get("X-User-Identity")).toBe("customer_42");
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

  it("bounds a streamed multipart body even when Content-Length understates it", async () => {
    const { sent } = stubUpstream();
    const stream = oversizedStream(26 * 1024 * 1024);

    const response = await postSpeakingMultipart(
      streamingRequest(
        "/api/demo/speaking/grading",
        stream.body,
        "multipart/form-data; boundary=demo",
        { "Content-Length": "1" }
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(stream.wasCanceled()).toBe(true);
    expect(sent).toHaveLength(0);
  });

  it("accepts the contract maximum with multipart framing under the 26 MiB wire limit", async () => {
    const form = new FormData();
    form.append(
      "audio",
      new File([new Uint8Array(MAX_SPEAKING_BYTES)], "answer.wav", {
        type: "audio/wav",
      }),
      "answer.wav"
    );
    form.append("part", "1");
    form.append("question_id", "p1_hometown");
    const original = new Request("http://127.0.0.1/api/demo/speaking/grading", {
      method: "POST",
      headers: {
        Origin: "http://127.0.0.1",
        "X-Demo-Api-Key": "sandbox-test-key",
        "X-Demo-Environment": "sandbox",
        "X-Demo-User-Identity": "00000000-0000-4000-8000-000000000001",
      },
      body: form,
    });
    const wireBody = await original.arrayBuffer();
    expect(wireBody.byteLength).toBeLessThanOrEqual(26 * 1024 * 1024);
    const headers = new Headers(original.headers);
    headers.set("Content-Length", String(wireBody.byteLength));
    const request = new Request(original.url, {
      method: "POST",
      headers,
      body: wireBody,
    });

    const parsed = await parseSpeakingRequest(request);

    expect(parsed.audio.size).toBe(MAX_SPEAKING_BYTES);
  });

  it("forwards the widened fields upstream instead of dropping them", async () => {
    const { sent } = stubUpstream();

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
