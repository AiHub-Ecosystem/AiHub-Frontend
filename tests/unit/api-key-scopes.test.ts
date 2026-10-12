import { describe, expect, it } from "vitest";
import { apiKeyScopeOptions } from "@/lib/api-key-scopes";
import { parseOrganizationRoster } from "@/lib/organizations";

describe("API key scope options", () => {
  it("makes only Writing requestable for a Writing entitlement", () => {
    expect(apiKeyScopeOptions(["writing"])).toEqual([
      {
        entitlement: "writing",
        scope: "writing.grade",
        service: "Writing",
        available: true,
      },
      {
        entitlement: "speaking",
        scope: "speaking.grade",
        service: "Speaking",
        available: false,
      },
    ]);
  });

  it("makes both scopes requestable when both entitlements are present", () => {
    expect(
      apiKeyScopeOptions(["writing", "speaking"]).map((option) => [
        option.scope,
        option.available,
      ])
    ).toEqual([
      ["writing.grade", true],
      ["speaking.grade", true],
    ]);
  });

  it("does not expose requestable scopes for unknown entitlements", () => {
    expect(
      apiKeyScopeOptions(["unknown"]).every((option) => !option.available)
    ).toBe(true);
  });

  it("keeps Organization entitlements from the roster for scope selection", () => {
    expect(
      parseOrganizationRoster({
        data: {
          organizations: [
            {
              organization_id: "org-1",
              name: "AIHub",
              status: "active",
              entitlements: ["writing", "speaking"],
              membership: { role: "owner" },
              members: [{ username: "owner", role: "owner" }],
            },
          ],
        },
        meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
      })
    ).toEqual([
      {
        id: "org-1",
        name: "AIHub",
        status: "active",
        membershipRole: "owner",
        entitlements: ["writing", "speaking"],
      },
    ]);
  });

  it("parses the backend's nested empty Organization roster", () => {
    expect(
      parseOrganizationRoster({
        data: { organizations: [] },
        meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
      })
    ).toEqual([]);
  });
});
