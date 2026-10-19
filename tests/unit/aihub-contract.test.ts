import { describe, expect, it } from "vitest";
import pinnedContract from "@/data/aihub-contract/openapi.json";
import policy from "@/data/aihub-contract/error-code-policy.json";
import limits from "@/data/aihub-contract/limits.json";
import {
  assertCandidateLimits,
  collectErrorCodes,
  contractLimits,
  unhandledErrorCodes,
  unhandledNewErrorCodes,
} from "../../scripts/check-aihub-contract.mjs";
import { createContractValidator } from "../e2e/aihub-contract.mjs";

function addCandidateErrorCode(document: typeof pinnedContract, code: string) {
  const candidate = structuredClone(document);
  for (const response of Object.values(candidate.components.responses)) {
    const schema = response.content?.["application/json"]?.schema as
      | {
          properties?: {
            error?: {
              properties?: {
                code?: { anyOf?: unknown[] };
              };
            };
          };
        }
      | undefined;
    const codes = schema?.properties?.error?.properties?.code?.anyOf;
    if (codes) {
      codes.push({ const: code, type: "string" });
      return candidate;
    }
  }
  throw new Error("No error response schema found in pinned OpenAPI");
}

describe("AIHUB pinned response contract", () => {
  it("reads runtime limits from the pinned OpenAPI schema", () => {
    expect(contractLimits(pinnedContract)).toEqual(limits);
  });

  it("requires a changed limit to update the pinned consumer contract", () => {
    const candidate = structuredClone(pinnedContract);
    candidate.paths["/v1/ielts/speaking/grading"].post.requestBody.content[
      "multipart/form-data"
    ].schema.properties.audio["x-max-bytes"] += 1;

    expect(() => assertCandidateLimits(pinnedContract, candidate)).toThrow(
      "Candidate AIHUB limits differ from the pinned Customer Web contract"
    );
  });

  it("accounts for every pinned error code with localized or safe generic copy", () => {
    const handled = new Set([
      ...Object.keys(policy.messages),
      ...policy.safeGenericCodes,
    ]);

    expect(unhandledErrorCodes(pinnedContract, handled)).toEqual([]);
  });

  it("rejects an invalid status or body response", () => {
    const validate = createContractValidator(pinnedContract);

    expect(
      validate({
        method: "POST",
        pathname: "/v1/auth/web-sessions/exchange",
        status: 200,
        body: Buffer.from(JSON.stringify({ data: { expires_in: "900" } })),
        contentType: "application/json",
      })
    ).not.toEqual([]);
    expect(
      validate({
        method: "POST",
        pathname: "/v1/auth/web-sessions/exchange",
        status: 204,
        body: Buffer.alloc(0),
      })
    ).not.toEqual([]);
  });

  it("ignores the test controls and synthetic outage while checking real API routes", () => {
    const validate = createContractValidator(pinnedContract);

    expect(
      validate({
        method: "GET",
        pathname: "/__test__/requests",
        status: 200,
        body: Buffer.from("{}"),
      })
    ).toEqual([]);
    expect(
      validate({
        method: "GET",
        pathname: "/v1/organizations/me/members",
        status: 503,
        body: Buffer.from('{"error":{"code":"LOCAL_MOCK_OUTAGE"}}'),
        contentType: "application/json",
      })
    ).toEqual([]);
  });

  it("blocks a new error code until Customer Web maps it or allowlists the safe fallback", () => {
    const candidate = addCandidateErrorCode(
      pinnedContract,
      "CONTRACT_TEST_NEW_ERROR"
    );
    const handled = new Set([
      ...Object.keys(policy.messages),
      ...policy.safeGenericCodes,
    ]);

    expect(collectErrorCodes(candidate)).toContain("CONTRACT_TEST_NEW_ERROR");
    expect(unhandledNewErrorCodes(pinnedContract, candidate, handled)).toEqual([
      "CONTRACT_TEST_NEW_ERROR",
    ]);
    expect(
      unhandledNewErrorCodes(
        pinnedContract,
        candidate,
        new Set([...handled, "CONTRACT_TEST_NEW_ERROR"])
      )
    ).toEqual([]);
  });
});
