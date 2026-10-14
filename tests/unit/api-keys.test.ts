import { describe, expect, it } from "vitest";
import { parseMintedOrganizationApiKey } from "@/lib/api-keys";
import {
  demoEnvironmentHintFromApiKey,
  demoEnvironmentRequiresSelection,
} from "@/lib/demo-environments";
import { isRawKeyFor, type SampleRequestKind } from "@/lib/sample-request";
import { buildSampleRequests } from "@/lib/sample-request";

const SECRET = "A".repeat(43);

function minted(rawKey: string) {
  return {
    data: {
      api_key: rawKey,
      id: "ak_01J00000000000000000000000",
      name: "Sandbox demo key",
      key_prefix: rawKey.slice(0, rawKey.indexOf(SECRET)),
      scopes: ["writing.grade"],
      allowed_environments: ["sandbox"],
      status: "active",
      expires_at: null,
      last_used_at: null,
      created_at: "2026-10-13T10:00:00.000Z",
    },
  };
}

describe("A minted key", () => {
  it("parses under every prefix the backend issues", () => {
    for (const prefix of ["aihub_sandbox_", "aihub_prod_", "aihub_sk_"])
      expect(
        parseMintedOrganizationApiKey(minted(`${prefix}${SECRET}`))
      ).toMatchObject({ api_key: `${prefix}${SECRET}` });
  });

  it("still refuses a prefix the backend issues no key under", () => {
    expect(
      parseMintedOrganizationApiKey(minted(`aihub_stg_${SECRET}`))
    ).toBeNull();
  });

  it("uses new environment prefixes only as a validation routing hint", () => {
    expect(demoEnvironmentHintFromApiKey(`aihub_sandbox_${SECRET}`)).toBe(
      "sandbox"
    );
    expect(demoEnvironmentHintFromApiKey(`aihub_prod_${SECRET}`)).toBe(
      "production"
    );
    expect(demoEnvironmentHintFromApiKey(`aihub_sk_${SECRET}`)).toBeNull();
    expect(demoEnvironmentRequiresSelection(`aihub_sk_${SECRET}`)).toBe(true);
    expect(demoEnvironmentRequiresSelection(`aihub_prod_${SECRET}`)).toBe(
      false
    );
    expect(demoEnvironmentRequiresSelection("")).toBe(false);
  });
});

describe("A key the holder pastes for a Sample request", () => {
  const apiKey = parseMintedOrganizationApiKey(
    minted(`aihub_sandbox_${SECRET}`)
  )!;

  function sampleFor(kind: SampleRequestKind) {
    return buildSampleRequests({
      apiKey,
      identityConfigured: false,
      idempotencyKey: "6f1ed729-8d92-4fa6-8e87-0fe6e71e9a17",
    }).find((request) => request.kind === kind);
  }

  it("recognises its own raw key under the environment prefix it was issued", () => {
    expect(isRawKeyFor(apiKey, `aihub_sandbox_${SECRET}`)).toBe(true);
  });

  it("refuses a key under another environment's prefix", () => {
    expect(isRawKeyFor(apiKey, `aihub_prod_${SECRET}`)).toBe(false);
  });

  it("refuses the shared legacy prefix for a key issued under another one", () => {
    expect(isRawKeyFor(apiKey, `aihub_sk_${SECRET}`)).toBe(false);
    expect(sampleFor("writing-task1")).toBeDefined();
  });
});
