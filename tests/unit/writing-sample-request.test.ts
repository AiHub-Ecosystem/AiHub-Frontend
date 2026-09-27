import { describe, expect, it } from "vitest";
import { WRITING_TASK2_REQUEST } from "@/data/api-reference";
import { buildWritingSampleRequest } from "@/lib/writing-sample-request";
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

describe("Writing Sample request", () => {
  it("builds a copyable request from the shared Task 2 example", () => {
    const apiKey = mintedKey();
    const sample = buildWritingSampleRequest({
      apiKey,
      identityConfigured: false,
      idempotencyKey,
    });

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
    expect(sample?.command).toContain(`API_KEY='${apiKey.api_key}'`);
    expect(sample?.command).toContain(`Idempotency-Key: \${IDEMPOTENCY_KEY}`);
    expect(sample?.command).toContain(
      JSON.stringify(WRITING_TASK2_REQUEST, null, 2)
    );
  });

  it("keeps the request details but omits the command without production", () => {
    const sample = buildWritingSampleRequest({
      apiKey: mintedKey({ allowed_environments: ["staging"] }),
      identityConfigured: false,
      idempotencyKey,
    });

    expect(sample?.url).toBe(
      "https://api.aihubproduction.com/v1/ielts/writing/task2/grade"
    );
    expect(sample?.command).toBeNull();
  });

  it.each([true, undefined])(
    "uses a User Assertion placeholder when identity readiness is %s",
    (identityConfigured) => {
      const sample = buildWritingSampleRequest({
        apiKey: mintedKey(),
        identityConfigured,
        idempotencyKey,
      });

      expect(sample?.headers[1]).toMatchObject({
        name: "X-User-Identity",
        value: "<user-assertion>",
      });
      expect(sample?.command).toContain("USER_IDENTITY='<user-assertion>'");
    }
  );

  it("does not create a Writing request for a key without writing.grade", () => {
    expect(
      buildWritingSampleRequest({
        apiKey: mintedKey({ scopes: ["speaking.grade"] }),
        identityConfigured: false,
        idempotencyKey,
      })
    ).toBeNull();
  });
});
