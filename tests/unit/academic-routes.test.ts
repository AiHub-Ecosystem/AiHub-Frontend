import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as queryReferences } from "@/app/api/portal/academic/references/query/route";
import { POST as acceptSample } from "@/app/api/portal/academic/samples/accept/route";
import { POST as generateSamples } from "@/app/api/portal/academic/samples/generate/route";
import { POST as rejectSample } from "@/app/api/portal/academic/samples/reject/route";
import { GET as listSamples } from "@/app/api/portal/academic/samples/route";
import { POST as generateExercise } from "@/app/api/demo/exercise-generation/generate/route";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CUSTOMER_WEB_ORIGIN;
  delete process.env.AIHUB_BASE_URL;
});

const ORIGIN = "http://localhost:3100";

/**
 * Answers the Web Session exchange, and fails every upstream academic call the
 * way an expired `AbortSignal.timeout` does, after checking the call carried a
 * signal at all: without one, a hung upstream holds the request open.
 */
function upstreamThatTimesOut() {
  const upstream = { calls: 0, withoutDeadline: 0 };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (String(input).endsWith("/v1/auth/web-sessions/exchange")) {
      return Response.json({
        data: { access_token: "access", expires_in: 300 },
      });
    }
    upstream.calls += 1;
    if (!(init?.signal instanceof AbortSignal)) upstream.withoutDeadline += 1;
    throw new DOMException("The operation timed out.", "TimeoutError");
  });
  return upstream;
}

function signedInRequest(path: string, method: "GET" | "POST") {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: {
      Origin: ORIGIN,
      Cookie: `__Host-aihub_web_session=${"a".repeat(43)}`,
      "Content-Type": "application/json",
    },
    ...(method === "POST" ? { body: JSON.stringify({ id: "sample_1" }) } : {}),
  });
}

describe("Academic routes give up on a slow upstream", () => {
  it.each([
    ["references/query", queryReferences, "POST"],
    ["samples/accept", acceptSample, "POST"],
    ["samples/generate", generateSamples, "POST"],
    ["samples/reject", rejectSample, "POST"],
    ["samples", listSamples, "GET"],
  ] as const)(
    "answers 502 when %s times out upstream",
    async (path, handler, method) => {
      process.env.CUSTOMER_WEB_ORIGIN = ORIGIN;
      process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
      const upstream = upstreamThatTimesOut();

      const response = await handler(
        signedInRequest(`/api/portal/academic/${path}`, method)
      );

      expect(response.status).toBe(502);
      expect(upstream).toEqual({ calls: 1, withoutDeadline: 0 });
    }
  );

  it("falls back to the local generator when exercise generation times out", async () => {
    const upstream = upstreamThatTimesOut();

    const response = await generateExercise(
      new Request("http://localhost/api/demo/exercise-generation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          writingTask: 2,
          topic: "environment",
          criterion: "coherence_cohesion",
          errorCode: "disorganized_structure",
          references: [{ prompt: "p" }],
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(upstream).toEqual({ calls: 1, withoutDeadline: 0 });
  });
});

describe("Academic routes", () => {
  it("refuses a cross-site sample decision before checking the session or calling upstream", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unexpected upstream request"));

    const response = await acceptSample(
      new Request("http://localhost:3100/api/portal/academic/samples/accept", {
        method: "POST",
        headers: {
          Origin: "https://evil.example",
          Cookie: `__Host-aihub_web_session=${"w".repeat(43)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: "sample_1" }),
      })
    );

    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not let an anonymous caller choose how many questions to generate", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ data: { exercise: [] } }));

    await generateExercise(
      new Request("http://localhost/api/demo/exercise-generation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          writingTask: 2,
          topic: "environment",
          criterion: "coherence_cohesion",
          errorCode: "disorganized_structure",
          references: [{ prompt: "p" }],
          numQuestions: 1000,
        }),
      })
    );

    const sent = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(sent.num_questions).toBe(3);
  });
});
