import { describe, expect, it } from "vitest";
import {
  organizationDestination,
  organizationLanding,
  validatedOrganizationName,
  type OrganizationMembership,
} from "@/lib/organizations";

const membership = (
  role: OrganizationMembership["membershipRole"],
  status: OrganizationMembership["status"] = "active",
  id = "org-123456789"
): OrganizationMembership => ({
  id,
  name: "AIHub",
  status,
  membershipRole: role,
});

describe("organization routing", () => {
  it.each([
    ["owner", "active", "/console/orgs/org-123456789/api-keys"],
    ["admin", "active", "/console/orgs/org-123456789/api-keys"],
    ["member", "active", "/console/orgs/org-123456789"],
    ["owner", "suspended", "/console/orgs/org-123456789"],
  ] as const)(
    "routes %s / %s to its allowed destination",
    (role, status, expected) => {
      expect(organizationDestination(membership(role, status))).toBe(expected);
    }
  );

  it("chooses create, one-organization destination, or picker by roster size", () => {
    expect(organizationLanding([])).toBe("/console/orgs/new");
    expect(organizationLanding([membership("owner")])).toBe(
      "/console/orgs/org-123456789/api-keys"
    );
    expect(
      organizationLanding([
        membership("owner"),
        membership("member", "active", "org-another"),
      ])
    ).toBe("/console");
  });
});

describe("Organization name validation", () => {
  it("trims and counts Unicode characters like the backend", () => {
    expect(validatedOrganizationName("  AIHub  ")).toBe("AIHub");
    expect(validatedOrganizationName("😀".repeat(100))).toBe("😀".repeat(100));
    expect(validatedOrganizationName("😀".repeat(101))).toBeNull();
    expect(validatedOrganizationName("   ")).toBeNull();
  });
});
