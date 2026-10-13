import { afterEach, describe, expect, it, vi } from "vitest";
import { WRITING_TASK1_CHART_TYPES } from "@/data/writing-task1-request";
import {
  gradeWriting,
  parseWritingRequest,
  ScoringBoundaryError,
} from "@/lib/scoring-gateway";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function jsonRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://127.0.0.1/api/demo/scoring/grade", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1",
      "X-Demo-Api-Key": "sandbox-test-key",
      "X-Demo-Environment": "sandbox",
      "X-Demo-User-Identity": "00000000-0000-4000-8000-000000000001",
      "Idempotency-Key": "11111111-2222-4333-8444-555555555555",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const TASK1_BODY = {
  task: 1,
  question: "Summarise the chart.",
  essay: "The bar chart shows telephone calls in the UK.",
  chart_type: "Bar Chart",
  image_url: "https://s3.wispace.app/ielts-task1/ca95bd4ab522946d",
};

const TASK2_BODY = {
  task: 2,
  question: "Do universities need vocational training?",
  essay: "Universities have traditionally focused on academic subjects.",
  topic: "education",
};

describe("parseWritingRequest", () => {
  it("parses a Task 1 body into camelCase fields", async () => {
    const parsed = await parseWritingRequest(jsonRequest(TASK1_BODY));

    expect(parsed).toMatchObject({
      task: 1,
      question: "Summarise the chart.",
      essay: "The bar chart shows telephone calls in the UK.",
      chartType: "Bar Chart",
      imageUrl: "https://s3.wispace.app/ielts-task1/ca95bd4ab522946d",
    });
  });

  it("parses a Task 2 body", async () => {
    const parsed = await parseWritingRequest(
      jsonRequest({
        task: 2,
        question: "Discuss both views.",
        topic: "education",
        essay: "Universities should offer vocational training.",
      })
    );

    expect(parsed).toMatchObject({ task: 2, topic: "education" });
  });

  it("accepts a chart hosted anywhere over https", async () => {
    const parsed = await parseWritingRequest(
      jsonRequest({
        ...TASK1_BODY,
        image_url: "https://my-company.example/charts/phone-calls.png",
      })
    );

    expect(parsed.imageUrl).toBe(
      "https://my-company.example/charts/phone-calls.png"
    );
  });

  it("accepts every one of the seven contract chart types", async () => {
    for (const chartType of WRITING_TASK1_CHART_TYPES) {
      const parsed = await parseWritingRequest(
        jsonRequest({ ...TASK1_BODY, chart_type: chartType })
      );
      expect(parsed.chartType).toBe(chartType);
    }
  });

  /**
   * `topic` is the essay's subject as free text, unlike `chart_type` which is a
   * fixed enum. The contract's only bounds are 1-200 characters and non-empty.
   * An allowlist of subjects would refuse every real submission outside it —
   * the same mistake as pinning an `image_url` host.
   */
  it("accepts any non-empty topic, not only the sample's subjects", async () => {
    const parsed = await parseWritingRequest(
      jsonRequest({
        task: 2,
        question: "Discuss both views.",
        topic: "urban beekeeping",
        essay: "Universities should offer vocational training.",
      })
    );

    expect(parsed).toMatchObject({ task: 2, topic: "urban beekeeping" });
  });
});

/**
 * The backend schemas are `additionalProperties: false` and every bound is
 * the backend's, not the demo's. A body the contract would 400 must be
 * rejected here, before a call leaves the server.
 */
const REJECTED: Array<[string, unknown]> = [
  ["an unknown field, Task 1", { ...TASK1_BODY, learner_id: "42" }],
  [
    "an unknown field, Task 2",
    {
      task: 2,
      question: "Discuss both views.",
      topic: "education",
      essay: "Universities should offer vocational training.",
      writer_id: "42",
    },
  ],
  // The contract is case-sensitive: "bar chart" is a 400, not a lowercase alias.
  ["a lowercase chart type", { ...TASK1_BODY, chart_type: "bar chart" }],
  [
    "a chart type the contract does not define",
    { ...TASK1_BODY, chart_type: "Bubble Chart" },
  ],
  [
    "an http image URL",
    { ...TASK1_BODY, image_url: "http://s3.wispace.app/chart.png" },
  ],
  [
    "credentials embedded in the image URL",
    { ...TASK1_BODY, image_url: "https://user:pass@s3.wispace.app/chart.png" },
  ],
  [
    "a question over 2000 characters",
    { ...TASK1_BODY, question: "q".repeat(2001) },
  ],
  [
    "an essay over 20000 characters",
    { ...TASK1_BODY, essay: "e".repeat(20_001) },
  ],
  [
    "an image URL over 2000 characters",
    { ...TASK1_BODY, image_url: `https://example.test/${"a".repeat(2000)}` },
  ],
  ["a blank question", { ...TASK1_BODY, question: "   " }],
  ["a blank essay", { ...TASK1_BODY, essay: "   " }],
  [
    "a missing question",
    {
      task: 1,
      essay: "An essay.",
      chart_type: "Bar Chart",
      image_url: "https://example.test/a.png",
    },
  ],
  [
    "a missing chart type",
    {
      task: 1,
      question: "Q.",
      essay: "E.",
      image_url: "https://example.test/a.png",
    },
  ],
  [
    "a missing image URL",
    { task: 1, question: "Q.", essay: "E.", chart_type: "Bar Chart" },
  ],
  // Task 2 fields belonging to the other task are rejected, not ignored.
  [
    "a Task 2 body carrying chart_type",
    {
      task: 2,
      question: "Discuss both views.",
      topic: "education",
      essay: "Universities should offer vocational training.",
      chart_type: "Bar Chart",
    },
  ],
  [
    "a Task 2 body carrying image_url",
    {
      task: 2,
      question: "Discuss both views.",
      topic: "education",
      essay: "Universities should offer vocational training.",
      image_url: "https://s3.wispace.app/ielts-task1/ca95bd4ab522946d",
    },
  ],
  [
    "an essay over 20000 characters, Task 2",
    {
      task: 2,
      question: "Discuss both views.",
      topic: "education",
      essay: "e".repeat(20_001),
    },
  ],
  [
    "a topic over 200 characters",
    {
      task: 2,
      question: "Discuss both views.",
      topic: "t".repeat(201),
      essay: "Universities should offer vocational training.",
    },
  ],
  ["a blank topic", { task: 2, question: "Q.", topic: " ", essay: "E." }],
  ["a missing topic", { task: 2, question: "Q.", essay: "E." }],
  ["a missing task", { question: "Q.", essay: "E.", topic: "education" }],
  ["a task the contract does not define", { ...TASK1_BODY, task: 3 }],
];

describe("parseWritingRequest rejections", () => {
  it.each(REJECTED)("rejects %s", async (_label, body) => {
    await expect(parseWritingRequest(jsonRequest(body))).rejects.toThrow(
      ScoringBoundaryError
    );
  });

  // Measured on the raw text before parsing, so an oversized body never gets
  // parsed at all.
  it("rejects a body over 256 KB", async () => {
    const oversized = new Request("http://127.0.0.1/api/demo/scoring/grade", {
      method: "POST",
      headers: { Origin: "http://127.0.0.1" },
      body: JSON.stringify({ ...TASK1_BODY, essay: "e".repeat(300_000) }),
    });

    await expect(parseWritingRequest(oversized)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
  });

  it("rejects a cross-origin request", async () => {
    const crossOrigin = new Request("http://127.0.0.1/api/demo/scoring/grade", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
      body: JSON.stringify(TASK1_BODY),
    });

    await expect(parseWritingRequest(crossOrigin)).rejects.toThrow(
      ScoringBoundaryError
    );
  });

  // The demo never sends a language, so allowing one it would then drop is a
  // hole: "en" would come back 200 carrying a Vietnamese grade.
  it.each([
    ["Task 1", { ...TASK1_BODY, language: "en" }],
    ["Task 2", { ...TASK2_BODY, language: "en" }],
    ["a non-string", { ...TASK2_BODY, language: 7 }],
  ])(
    "rejects a language field on %s rather than dropping it",
    async (_l, body) => {
      await expect(
        parseWritingRequest(jsonRequest(body))
      ).rejects.toMatchObject({
        code: "INVALID_REQUEST",
      });
    }
  );
});

const UPSTREAM_GRADING = {
  data: {
    overall_band: 6.5,
    language: "vi",
    criteria: [
      {
        id: "task_achievement",
        name: "Task Achievement",
        band: 6.5,
        band_reason: "Có overview và so sánh.",
        strengths: ["Mở bài nêu đúng đại lượng."],
        improvements: ["Nêu số của Russia."],
      },
      {
        id: "coherence_cohesion",
        name: "Coherence and Cohesion",
        band: 6.5,
        band_reason: "Ý đi từ số lớn đến số nhỏ.",
        strengths: ["Câu Overall tóm tắt."],
        improvements: ["Tách mở bài và overview."],
      },
      {
        id: "lexical_resource",
        name: "Lexical Resource",
        band: 6,
        band_reason: "Dùng đúng production capacity.",
        strengths: ["Dùng đúng estimated production capacity."],
        improvements: ["Dùng a large gap in production capacity."],
      },
      {
        id: "grammatical_range_accuracy",
        name: "Grammatical Range and Accuracy",
        band: 6.5,
        band_reason: "Một câu thừa động từ were.",
        strengths: ["Cụm almost three times diễn đạt rõ."],
        improvements: ["Bỏ were sau produced."],
      },
    ],
    summary: "Bài đạt band 6.5 và có overview.",
    suggestions: ["Bổ sung số ước tính của Russia."],
    next_steps: ["Luyện mô tả biểu đồ cột một mốc thời gian."],
    annotations: [
      {
        criterion: "lexical_resource",
        issue: "imprecise_word_choice",
        quote: "a big increase of production",
        explanation: "Biểu đồ chỉ có năm 2010 nên không thể kết luận tăng.",
      },
    ],
  },
  meta: { request_id: "req_upstream" },
};

/**
 * A rubric that is structurally valid but not a grade: fewer than four
 * criteria, a repeated one, or an id the contract does not define. Rendering
 * any of these would show a visitor a successful result against a rubric that
 * is missing a criterion they are being graded on.
 */
const BROKEN_CRITERIA: Array<[string, unknown[]]> = [
  ["fewer than four", UPSTREAM_GRADING.data.criteria.slice(0, 3)],
  [
    "a repeated criterion",
    UPSTREAM_GRADING.data.criteria.map((c, i) =>
      i === 1 ? { ...c, id: "task_achievement" } : c
    ),
  ],
  [
    "an id the contract does not define",
    UPSTREAM_GRADING.data.criteria.map((c, i) =>
      i === 3 ? { ...c, id: "vibes" } : c
    ),
  ],
  ["an empty rubric", []],
];

describe("an upstream rubric that is not a grade", () => {
  it.each(BROKEN_CRITERIA)(
    "refuses %s rather than reporting it as a result",
    async (_label, criteria) => {
      stubUpstream(
        () =>
          new Response(
            JSON.stringify({
              ...UPSTREAM_GRADING,
              data: { ...UPSTREAM_GRADING.data, criteria },
            }),
            { status: 200 }
          )
      );

      await expect(
        gradeWriting(jsonRequest(TASK2_BODY), "req_test")
      ).rejects.toMatchObject({ code: "AI_SERVICE_CONTRACT_VIOLATION" });
    }
  );
});

function stubUpstream(
  responder: () => Response = () =>
    new Response(JSON.stringify(UPSTREAM_GRADING), { status: 200 })
) {
  const calls: Array<{ url: string; headers: Headers; body: unknown }> = [];
  vi.stubEnv("AIHUB_SANDBOX_BASE_URL", "https://sandbox.aihubproduction.com");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(url),
        headers,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return responder();
    })
  );
  return calls;
}

describe("gradeWriting upstream call", () => {
  it("posts to the task's own upstream path in snake_case", async () => {
    const calls = stubUpstream();

    await gradeWriting(jsonRequest(TASK1_BODY), "req_test");

    expect(calls[0].url).toBe(
      "https://sandbox.aihubproduction.com/v1/ielts/writing/task1/grade"
    );
    expect(calls[0].body).toEqual({
      question: TASK1_BODY.question,
      essay: TASK1_BODY.essay,
      chart_type: "Bar Chart",
      image_url: TASK1_BODY.image_url,
    });
  });

  it("routes Task 2 to its own path and sends topic", async () => {
    const calls = stubUpstream();

    await gradeWriting(
      jsonRequest({
        task: 2,
        question: "Discuss both views.",
        topic: "education",
        essay: "Universities should offer vocational training.",
      }),
      "req_test"
    );

    expect(calls[0].url).toBe(
      "https://sandbox.aihubproduction.com/v1/ielts/writing/task2/grade"
    );
    expect(calls[0].body).toMatchObject({ topic: "education" });
    expect(calls[0].body).not.toHaveProperty("chart_type");
  });

  it("forwards the temporary demo UUID as user identity", async () => {
    const calls = stubUpstream();

    await gradeWriting(jsonRequest(TASK1_BODY), "req_test");

    expect(calls).toHaveLength(1);
    expect(calls[0].headers.get("x-user-identity")).toBe(
      "00000000-0000-4000-8000-000000000001"
    );
  });

  it("forwards the browser's idempotency key to the grading API", async () => {
    const calls = stubUpstream();

    await gradeWriting(jsonRequest(TASK1_BODY), "req_test");

    expect(calls[0].headers.get("idempotency-key")).toBe(
      "11111111-2222-4333-8444-555555555555"
    );
  });

  it("rejects a missing or malformed idempotency key before dispatch", async () => {
    const calls = stubUpstream();

    await expect(
      gradeWriting(
        jsonRequest(TASK1_BODY, { "Idempotency-Key": "not-a-uuid" }),
        "req_test"
      )
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(calls).toHaveLength(0);

    await expect(
      gradeWriting(
        new Request("http://127.0.0.1/api/demo/scoring/grade", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://127.0.0.1",
            "X-Demo-Api-Key": "sandbox-test-key",
            "X-Demo-Environment": "sandbox",
            "X-Demo-User-Identity": "00000000-0000-4000-8000-000000000001",
          },
          body: JSON.stringify(TASK1_BODY),
        }),
        "req_test"
      )
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(calls).toHaveLength(0);
  });

  it("never lets the API key reach the parsed response", async () => {
    stubUpstream();

    const result = await gradeWriting(jsonRequest(TASK1_BODY), "req_test");

    expect(JSON.stringify(result)).not.toContain("aihub_sk_test");
  });

  it("returns the criteria in the order the response carries them", async () => {
    stubUpstream();

    const result = await gradeWriting(jsonRequest(TASK1_BODY), "req_test");

    expect(result.data.criteria.map((criterion) => criterion.id)).toEqual([
      "task_achievement",
      "coherence_cohesion",
      "lexical_resource",
      "grammatical_range_accuracy",
    ]);
  });

  it("rebuilds meta for the gateway rather than passing upstream meta through", async () => {
    stubUpstream();

    const result = await gradeWriting(jsonRequest(TASK1_BODY), "req_test");

    expect(result.meta).toMatchObject({
      request_id: "req_test",
      correlation_id: "req_test",
      service: "writing",
      operation: "writing.task1.grade",
    });
  });
});

describe("upstream error pass-through", () => {
  /**
   * The 19 codes separate situations a visitor must tell apart. Collapsing
   * them into one message tells a visitor something false.
   */
  it("keeps the upstream code and its retry hint, replacing only the message", async () => {
    stubUpstream(
      () =>
        new Response(
          JSON.stringify({
            error: {
              code: "QUOTA_EXCEEDED",
              message: "quota exhausted for org 7 at 2026-10-11",
              retryable: true,
              retry_after_ms: 86_400_000,
            },
          }),
          { status: 429 }
        )
    );

    await expect(
      gradeWriting(jsonRequest(TASK1_BODY), "req_test")
    ).rejects.toMatchObject({
      code: "QUOTA_EXCEEDED",
      retryable: true,
      retry_after_ms: 86_400_000,
    });
  });

  it("tells a rate limit apart from an exhausted quota", async () => {
    stubUpstream(
      () =>
        new Response(
          JSON.stringify({
            error: {
              code: "RATE_LIMITED",
              retryable: true,
              retry_after_ms: 2000,
            },
          }),
          { status: 429 }
        )
    );

    await expect(
      gradeWriting(jsonRequest(TASK1_BODY), "req_test")
    ).rejects.toMatchObject({ code: "RATE_LIMITED", retry_after_ms: 2000 });
  });

  it("keeps a code with no table entry and omits an absent retry hint", async () => {
    stubUpstream(
      () =>
        new Response(
          JSON.stringify({
            error: { code: "SOME_UNMAPPED_CODE", retryable: false },
          }),
          { status: 409 }
        )
    );

    await expect(
      gradeWriting(jsonRequest(TASK1_BODY), "req_test")
    ).rejects.toMatchObject({
      code: "SOME_UNMAPPED_CODE",
      retryable: false,
    });
    // No hint upstream, no hint here. Omitting the key from the serialized
    // payload is the route's job, not the gateway's.
    await expect(
      gradeWriting(jsonRequest(TASK1_BODY), "req_test")
    ).rejects.toMatchObject({ retry_after_ms: undefined });
  });

  it("rejects a successful response that breaks the grading contract", async () => {
    stubUpstream(
      () =>
        new Response(JSON.stringify({ data: { overall_band: 6.5 } }), {
          status: 200,
        })
    );

    await expect(
      gradeWriting(jsonRequest(TASK1_BODY), "req_test")
    ).rejects.toMatchObject({ code: "AI_SERVICE_CONTRACT_VIOLATION" });
  });

  // The report prints `meta.request_id`, so an envelope without one is not
  // renderable. Casting it would type a value that is not there.
  it("rejects a 200 whose envelope carries no request_id", async () => {
    stubUpstream(
      () =>
        new Response(
          JSON.stringify({ ...UPSTREAM_GRADING, meta: { request_id: 7 } }),
          { status: 200 }
        )
    );

    await expect(
      gradeWriting(jsonRequest(TASK1_BODY), "req_test")
    ).rejects.toMatchObject({ code: "AI_SERVICE_CONTRACT_VIOLATION" });
  });

  // A 429 the demo cannot name is still a rate limit, and the sandbox returns
  // one a visitor will meet. Speaking maps it the same way.
  it("reports a bodyless 429 as throttled rather than a generic failure", async () => {
    stubUpstream(() => new Response("too many", { status: 429 }));

    await expect(
      gradeWriting(jsonRequest(TASK1_BODY), "req_test")
    ).rejects.toMatchObject({ code: "AI_SERVICE_THROTTLED" });
  });

  it("maps an unreachable upstream to unavailable rather than a made-up code", async () => {
    vi.stubEnv("AIHUB_SANDBOX_BASE_URL", "https://sandbox.aihubproduction.com");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    await expect(
      gradeWriting(jsonRequest(TASK1_BODY), "req_test")
    ).rejects.toMatchObject({ code: "AI_SERVICE_UNAVAILABLE" });
  });
});
