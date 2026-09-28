import { describe, expect, it } from "vitest";
import {
  WRITING_TASK1_CHART_TYPES,
  WRITING_TASK1_REQUEST,
} from "@/data/writing-task1-request";
import { WRITING_TASK2_REQUEST } from "@/data/writing-task2-request";
import {
  buildSampleRequests,
  type SampleRequestKind,
} from "@/lib/sample-request";
import type { MintedOrganizationApiKey } from "@/lib/api-keys";

const idempotencyKey = "6f1ed729-8d92-4fa6-8e87-0fe6e71e9a17";

function mintedKey(
  overrides: Partial<MintedOrganizationApiKey> = {}
): MintedOrganizationApiKey {
  return {
    id: "ak_01J00000000000000000000000",
    name: "Production backend",
    key_prefix: "aihub_sk_ABC123",
    scopes: ["writing.grade"],
    allowed_environments: ["production"],
    status: "active",
    expires_at: null,
    last_used_at: null,
    created_at: "2026-09-27T10:00:00.000Z",
    api_key: `aihub_sk_${"A".repeat(43)}`,
    ...overrides,
  };
}

function sampleFor(
  apiKey: MintedOrganizationApiKey,
  kind: SampleRequestKind,
  identityConfigured?: boolean
) {
  return buildSampleRequests({
    apiKey,
    identityConfigured,
    idempotencyKey,
  }).find((request) => request.kind === kind);
}

describe("Request identity", () => {
  function kindsFor(apiKey: MintedOrganizationApiKey) {
    return buildSampleRequests({
      apiKey,
      identityConfigured: false,
      idempotencyKey,
    }).map((request) => request.kind);
  }

  /**
   * The tab list keys and identifies every request by its identity, so a second
   * request arriving under a scope already in use must not reuse the first one's
   * identity. Asserted on the real output, which is what the tab reads. The
   * second Writing request itself is #32, and the collision this guards against
   * can only be observed once it exists.
   */
  it("gives every request of a key a distinct identity", () => {
    const kinds = kindsFor(
      mintedKey({ scopes: ["speaking.grade", "writing.grade"] })
    );

    expect(kinds).toEqual(["writing-task1", "writing-task2", "speaking"]);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("names each request from the request, not from its scope", () => {
    const requests = buildSampleRequests({
      apiKey: mintedKey({ scopes: ["speaking.grade", "writing.grade"] }),
      identityConfigured: false,
      idempotencyKey,
    });

    expect(requests.map((request) => [request.kind, request.label])).toEqual([
      ["writing-task1", "Writing Task 1"],
      ["writing-task2", "Writing Task 2"],
      ["speaking", "Speaking"],
    ]);
    for (const request of requests)
      expect(request.label).not.toBe(request.kind);
  });
});

describe("Sample request tabs", () => {
  it("gives a key one tab per scope it holds, Writing first", () => {
    const apiKey = mintedKey({ scopes: ["speaking.grade", "writing.grade"] });

    const samples = buildSampleRequests({
      apiKey,
      identityConfigured: false,
      idempotencyKey,
    });

    expect(samples.map((sample) => [sample.kind, sample.label])).toEqual([
      ["writing-task1", "Writing Task 1"],
      ["writing-task2", "Writing Task 2"],
      ["speaking", "Speaking"],
    ]);
  });

  it("shows only the Speaking tab for a key without writing.grade", () => {
    const samples = buildSampleRequests({
      apiKey: mintedKey({ scopes: ["speaking.grade"] }),
      identityConfigured: false,
      idempotencyKey,
    });

    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ kind: "speaking", label: "Speaking" });
  });

  it("shows only the Writing tab for a key without speaking.grade", () => {
    const samples = buildSampleRequests({
      apiKey: mintedKey({ scopes: ["writing.grade"] }),
      identityConfigured: false,
      idempotencyKey,
    });

    expect(samples.map((sample) => sample.kind)).toEqual([
      "writing-task1",
      "writing-task2",
    ]);
  });

  it("shows no tab for a scope with no known endpoint", () => {
    expect(
      buildSampleRequests({
        apiKey: mintedKey({ scopes: ["speech.toText"] }),
        identityConfigured: false,
        idempotencyKey,
      })
    ).toEqual([]);
  });

  it("keeps the known tabs and skips unknown scopes", () => {
    const samples = buildSampleRequests({
      apiKey: mintedKey({ scopes: ["speech.toText", "speaking.grade"] }),
      identityConfigured: false,
      idempotencyKey,
    });

    expect(samples.map((sample) => sample.kind)).toEqual(["speaking"]);
  });
});

describe("Writing Task 1 Sample request", () => {
  const task1 = () => sampleFor(mintedKey(), "writing-task1", false);

  it("targets the Task 1 grading endpoint", () => {
    expect(task1()?.url).toBe(
      "https://api.aihubproduction.com/v1/ielts/writing/task1/grade"
    );
    expect(task1()?.command).toContain("/v1/ielts/writing/task1/grade");
  });

  it("orders the body rows exactly as the command sends the fields", () => {
    expect(task1()?.body.map((field) => field.field)).toEqual(
      Object.keys(WRITING_TASK1_REQUEST)
    );
    for (const field of task1()?.body ?? []) expect(field.required).toBe(true);
  });

  it("sends no field Task 1 rejects", () => {
    const sent = Object.keys(WRITING_TASK1_REQUEST);

    expect(sent).not.toContain("topic");
    expect(sent).toEqual(["question", "chart_type", "image_url", "essay"]);
  });

  it("lists the seven chart types and says how they are matched", () => {
    const meaning =
      task1()?.body.find((field) => field.field === "chart_type")?.meaning ??
      "";

    for (const chartType of WRITING_TASK1_CHART_TYPES)
      expect(meaning).toContain(chartType);
    expect(meaning).toMatch(/HOA THƯỜNG/);
    expect(meaning).toMatch(/environment/);
  });

  it("names the criterion Task 1 leads with, not Task 2's", () => {
    expect(task1()?.firstCriterion).toBe("task_achievement");
    expect(sampleFor(mintedKey(), "writing-task2", false)?.firstCriterion).toBe(
      "task_response"
    );
  });

  it("sends the chart AIHUB publishes, so the command runs as copied", () => {
    const sample = task1();
    const image = sample?.body.find((field) => field.field === "image_url");

    expect(image?.sampleValue).toBe(
      "https://s3.wispace.app/ielts-task1/ca95bd4ab522946d"
    );
    expect(sample?.command).toContain(
      '"image_url": "https://s3.wispace.app/ielts-task1/ca95bd4ab522946d"'
    );
    expect(
      sample?.body.find((field) => field.field === "question")?.sampleValue
    ).toMatch(/telephone calls in the UK/);
  });

  it("says AIHUB's image works and that an unreachable replacement is not an error", () => {
    const note = task1()?.note ?? "";

    expect(note).not.toMatch(/URL giữ chỗ/);
    expect(note).toMatch(/biểu đồ mẫu AIHUB công bố/);
    expect(note).toMatch(/thay bằng ảnh biểu đồ của bạn/);
    expect(note).toMatch(/không trả lỗi/);
    expect(note).toMatch(/kết quả sẽ sai/);
  });

  it("keeps the image note off the Task 2 request", () => {
    expect(sampleFor(mintedKey(), "writing-task2", false)?.note).not.toMatch(
      /image_url/
    );
  });

  it("shares the dialog's one idempotency key with Task 2", () => {
    const requests = buildSampleRequests({
      apiKey: mintedKey(),
      identityConfigured: false,
      idempotencyKey,
    });
    const keyOf = (kind: string) =>
      requests
        .find((request) => request.kind === kind)
        ?.headers.find((header) => header.name === "Idempotency-Key")?.value;

    expect(keyOf("writing-task1")).toBe(idempotencyKey);
    expect(keyOf("writing-task1")).toBe(keyOf("writing-task2"));
  });

  it.each([true, undefined])(
    "handles identity readiness %s the same way Task 2 does",
    (identityConfigured) => {
      const requests = buildSampleRequests({
        apiKey: mintedKey(),
        identityConfigured,
        idempotencyKey,
      });
      const identityOf = (kind: string) =>
        requests
          .find((request) => request.kind === kind)
          ?.headers.find((header) => header.name === "X-User-Identity")?.value;

      expect(identityOf("writing-task1")).toBe(identityOf("writing-task2"));
      expect(identityOf("writing-task1")).toBe(
        identityConfigured === false ? "test-user-1" : "<user-assertion>"
      );
    }
  );

  it("targets the Sandbox host for a Sandbox key", () => {
    const sandbox = sampleFor(
      mintedKey({ allowed_environments: ["sandbox"] }),
      "writing-task1",
      false
    );

    expect(sandbox?.url).toBe(
      "https://sandbox.aihubproduction.com/v1/ielts/writing/task1/grade"
    );
    expect(sandbox?.usageNote).toMatch(/miễn phí/);
  });
});

describe("Writing Sample request", () => {
  it("builds a copyable request from the shared Task 2 example", () => {
    const apiKey = mintedKey();
    const sample = sampleFor(apiKey, "writing-task2", false);

    expect(sample).toMatchObject({
      method: "POST",
      url: "https://api.aihubproduction.com/v1/ielts/writing/task2/grade",
      headers: [
        { name: "X-API-Key", value: "aihub_sk_ABC123…" },
        { name: "X-User-Identity", value: "test-user-1" },
        { name: "Content-Type", value: "application/json" },
        { name: "Idempotency-Key", value: idempotencyKey },
      ],
      body: [
        {
          field: "question",
          sampleValue: WRITING_TASK2_REQUEST.question,
          required: true,
        },
        {
          field: "topic",
          sampleValue: WRITING_TASK2_REQUEST.topic,
          required: true,
        },
        {
          field: "essay",
          sampleValue: WRITING_TASK2_REQUEST.essay,
          required: true,
        },
      ],
    });
    expect(sample?.command).toContain(
      `API_KEY="\${API_KEY:?Chạy export API_KEY=<API key của bạn> trước}"`
    );
    expect(sample?.command).toContain(`Idempotency-Key: \${IDEMPOTENCY_KEY}`);
    expect(sample?.command).toContain(
      JSON.stringify(WRITING_TASK2_REQUEST, null, 2)
    );
  });

  it("tells a rerun replays the stored result", () => {
    expect(sampleFor(mintedKey(), "writing-task2", false)?.note).toMatch(
      /phát lại kết quả.*24 giờ/
    );
  });

  it("keeps the request details but omits the command without production", () => {
    const sample = sampleFor(
      mintedKey({ allowed_environments: ["staging"] }),
      "writing-task2",
      false
    );

    expect(sample?.url).toBe("/v1/ielts/writing/task2/grade");
    expect(sample?.command).toBeNull();
  });

  it.each([true, undefined])(
    "uses a User Assertion placeholder when identity readiness is %s",
    (identityConfigured) => {
      const sample = sampleFor(
        mintedKey(),
        "writing-task2",
        identityConfigured
      );

      expect(sample?.headers[1]).toMatchObject({
        name: "X-User-Identity",
        value: "<user-assertion>",
      });
      expect(sample?.command).toContain("USER_IDENTITY='<user-assertion>'");
    }
  );
});

describe("Speaking Sample request", () => {
  it("presents the grading endpoint as multipart with masked key", () => {
    const sample = sampleFor(
      mintedKey({ scopes: ["speaking.grade"] }),
      "speaking",
      false
    );

    expect(sample).toMatchObject({
      method: "POST",
      url: "https://api.aihubproduction.com/v1/ielts/speaking/grading",
      headers: [
        { name: "X-API-Key", value: "aihub_sk_ABC123…" },
        { name: "X-User-Identity", value: "test-user-1" },
      ],
    });
  });

  it("carries no Idempotency-Key and warns that a rerun grades again", () => {
    const sample = sampleFor(
      mintedKey({ scopes: ["speaking.grade"] }),
      "speaking",
      false
    );

    expect(
      sample?.headers.some((header) => header.name === "Idempotency-Key")
    ).toBe(false);
    expect(sample?.command).not.toContain("Idempotency-Key");
    expect(sample?.note).toMatch(/chưa hỗ trợ Idempotency-Key/);
    expect(sample?.note).toMatch(/chấm.*(lần nữa|lại)/);
  });

  it("points the audio at a file the holder supplies", () => {
    const sample = sampleFor(
      mintedKey({ scopes: ["speaking.grade"] }),
      "speaking",
      false
    );

    expect(sample?.body[0]).toMatchObject({
      field: "audio",
      required: true,
    });
    expect(sample?.body[0]?.meaning).toMatch(/file.*của bạn/);
    expect(sample?.command).toContain("AUDIO_FILE='./answer.wav'");
    expect(sample?.command).toContain('-F "audio=@${AUDIO_FILE}"');
  });

  it("sends every form field the grading endpoint requires", () => {
    const command = sampleFor(
      mintedKey({ scopes: ["speaking.grade"] }),
      "speaking",
      false
    )?.command;

    expect(command).toContain('-F "part=1"');
    expect(command).toContain('-F "question_id=p1_hometown"');
    expect(command).toContain(
      '-F "prompt_text=Do you enjoy living in your hometown?"'
    );
    expect(command).toContain('-F "test_type=Practice"');
  });

  it("marks the question id as a value the holder replaces", () => {
    const sample = sampleFor(
      mintedKey({ scopes: ["speaking.grade"] }),
      "speaking",
      false
    );
    const question = sample?.body.find(
      (field) => field.field === "question_id"
    );

    expect(question).toMatchObject({ sampleValue: "p1_hometown" });
    expect(question?.meaning).toMatch(/thay bằng/);
  });

  it("marks the fields the grading contract requires, not the demo's", () => {
    const body =
      sampleFor(mintedKey({ scopes: ["speaking.grade"] }), "speaking", false)
        ?.body ?? [];

    expect(body.map((field) => [field.field, field.required])).toEqual([
      ["audio", true],
      ["part", true],
      ["question_id", true],
      ["prompt_text", false],
      ["test_type", false],
      ["test_code", false],
      ["transcript", false],
    ]);
  });

  it("documents the fields the sample command does not send", () => {
    const command = sampleFor(
      mintedKey({ scopes: ["speaking.grade"] }),
      "speaking",
      false
    )?.command;

    expect(command).not.toContain("test_code");
    expect(command).not.toContain('-F "transcript=');
  });

  it("omits a hand-written content type so the boundary survives", () => {
    const sample = sampleFor(
      mintedKey({ scopes: ["speaking.grade"] }),
      "speaking",
      false
    );

    expect(
      sample?.headers.some((header) => header.name === "Content-Type")
    ).toBe(false);
    expect(sample?.command).not.toContain("Content-Type");
    expect(sample?.contentTypeNote).toMatch(/boundary/);
  });

  it("ends both commands without a dangling line continuation", () => {
    const speaking = sampleFor(
      mintedKey({ scopes: ["speaking.grade"] }),
      "speaking",
      false
    );

    expect(speaking?.command?.endsWith("\\")).toBe(false);
    expect(
      sampleFor(mintedKey(), "writing-task2", false)?.command?.endsWith("\\")
    ).toBe(false);
  });

  it("shows the fields a successful response carries", () => {
    const sample = sampleFor(
      mintedKey({ scopes: ["speaking.grade"] }),
      "speaking",
      false
    );

    expect(sample?.expectedOutcomeFields).toEqual([
      "scorability",
      "estimated_band",
      "transcript",
    ]);
  });

  it("keeps the request details but omits the command without production", () => {
    const sample = sampleFor(
      mintedKey({
        scopes: ["speaking.grade"],
        allowed_environments: ["staging"],
      }),
      "speaking",
      false
    );

    expect(sample?.url).toBe("/v1/ielts/speaking/grading");
    expect(sample?.command).toBeNull();
  });

  it.each([true, undefined])(
    "uses a User Assertion placeholder when identity readiness is %s",
    (identityConfigured) => {
      const sample = sampleFor(
        mintedKey({ scopes: ["speaking.grade"] }),
        "speaking",
        identityConfigured
      );

      expect(sample?.headers[1]).toMatchObject({
        name: "X-User-Identity",
        value: "<user-assertion>",
      });
      expect(sample?.command).toContain("USER_IDENTITY='<user-assertion>'");
    }
  );
});

describe("Sandbox Environment", () => {
  const sandboxKey = mintedKey({ allowed_environments: ["sandbox"] });

  it("marks a Sandbox call free, a production call paid, and no command neither", () => {
    const billingFor = (environment: string) =>
      sampleFor(
        mintedKey({ allowed_environments: [environment] }),
        "writing-task2",
        false
      )?.billing;

    expect(billingFor("sandbox")).toBe("free");
    expect(billingFor("production")).toBe("paid");
    expect(billingFor("staging")).toBeNull();
  });

  it("targets the Sandbox host and keeps a runnable command", () => {
    const sample = sampleFor(sandboxKey, "writing-task2", false);

    expect(sample?.url).toBe(
      "https://sandbox.aihubproduction.com/v1/ielts/writing/task2/grade"
    );
    expect(sample?.command).toContain(
      "https://sandbox.aihubproduction.com/v1/ielts/writing/task2/grade"
    );
  });

  it("shows only the Writing tab, because a Sandbox key carries only writing.grade", () => {
    const samples = buildSampleRequests({
      apiKey: sandboxKey,
      identityConfigured: false,
      idempotencyKey,
    });

    expect(samples.map((sample) => sample.kind)).toEqual([
      "writing-task1",
      "writing-task2",
    ]);
  });

  it("warns that the call is free, bounded, and counted per Organization", () => {
    const usageNote =
      sampleFor(sandboxKey, "writing-task2", false)?.usageNote ?? "";

    expect(usageNote).toMatch(/miễn phí/);
    expect(usageNote).toMatch(/không tính vào hạn mức trả phí/);
    expect(usageNote).toMatch(/25 lần chấm mỗi tháng/);
    expect(usageNote).toMatch(/tính theo Organization, không tính theo key/);
    expect(usageNote).toMatch(/429 QUOTA_EXCEEDED/);
    expect(usageNote).toMatch(/00:00 UTC/);
  });

  it("keeps the paid usage warning for a production key", () => {
    expect(sampleFor(mintedKey(), "writing-task2", false)?.usageNote).toBe(
      "Lệnh gửi request thật và tính vào hạn mức sử dụng của Organization."
    );
  });

  it("carries no usage warning when no Environment has a public host", () => {
    expect(
      sampleFor(
        mintedKey({ allowed_environments: ["staging"] }),
        "writing-task2",
        false
      )?.usageNote
    ).toBe("");
  });

  it("prefers Sandbox when a key allows both tiers, so the first call is free", () => {
    const sample = sampleFor(
      mintedKey({ allowed_environments: ["production", "sandbox"] }),
      "writing-task2",
      false
    );

    expect(sample?.url).toBe(
      "https://sandbox.aihubproduction.com/v1/ielts/writing/task2/grade"
    );
  });

  const casesWithoutAPublicHost: [string, string[]][] = [
    ["an empty list", []],
    ["an Environment the Console does not name", ["eu-west"]],
    ["only staging", ["staging"]],
  ];

  it.each(casesWithoutAPublicHost)(
    "yields no command and no warning for %s",
    (_case, allowedEnvironments) => {
      const sample = sampleFor(
        mintedKey({ allowed_environments: allowedEnvironments }),
        "writing-task2",
        false
      );

      expect(sample?.command).toBeNull();
      expect(sample?.usageNote).toBe("");
    }
  );
});

describe("Raw key", () => {
  it("never appears in a Sample request, even one built from a freshly minted key", () => {
    const apiKey = mintedKey({ scopes: ["writing.grade", "speaking.grade"] });
    const samples = buildSampleRequests({
      apiKey,
      identityConfigured: false,
      idempotencyKey,
    });

    expect(samples.map((sample) => sample.kind)).toEqual([
      "writing-task1",
      "writing-task2",
      "speaking",
    ]);
    for (const sample of samples) {
      expect(JSON.stringify(sample)).not.toContain(apiKey.api_key);
      expect(sample.command).not.toContain("undefined");
      expect(sample.command).toContain(
        `API_KEY="\${API_KEY:?Chạy export API_KEY=<API key của bạn> trước}"`
      );
    }
  });
});
