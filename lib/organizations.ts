export type OrganizationMembership = {
  id: string;
  name: string;
  status: "active" | "suspended";
  membershipRole: "owner" | "admin" | "member";
  entitlements: string[];
  identityConfigured?: boolean;
};

export function validatedOrganizationName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  const length = [...name].length;
  return length >= 1 && length <= 100 ? name : null;
}

export function organizationDestination(organization: OrganizationMembership) {
  const base = `/console/orgs/${encodeURIComponent(organization.id)}`;
  return organization.status === "active" &&
    (organization.membershipRole === "owner" ||
      organization.membershipRole === "admin")
    ? `${base}/api-keys`
    : base;
}

export function organizationLanding(roster: OrganizationMembership[]) {
  if (roster.length === 0) return "/console/orgs";
  if (roster.length === 1) return organizationDestination(roster[0]);
  return "/console/orgs";
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseOrganizationRoster(
  value: unknown
): OrganizationMembership[] | null {
  const root = record(value);
  const organizations = record(root?.data)?.organizations;
  if (!Array.isArray(organizations)) return null;
  const roster: OrganizationMembership[] = [];
  for (const item of organizations) {
    const row = record(item);
    const membership = record(row?.membership);
    const {
      organization_id: id,
      name,
      status,
      entitlements,
      identity_configured: identityConfigured,
    } = row ?? {};
    const membershipRole = membership?.role;
    if (
      typeof id !== "string" ||
      !id ||
      typeof name !== "string" ||
      !name ||
      (status !== "active" && status !== "suspended") ||
      !Array.isArray(entitlements) ||
      entitlements.some(
        (entitlement) => typeof entitlement !== "string" || !entitlement
      ) ||
      (membershipRole !== "owner" &&
        membershipRole !== "admin" &&
        membershipRole !== "member") ||
      (identityConfigured !== undefined &&
        typeof identityConfigured !== "boolean")
    )
      return null;
    roster.push({
      id,
      name,
      status,
      membershipRole,
      entitlements,
      ...(typeof identityConfigured === "boolean"
        ? { identityConfigured }
        : {}),
    });
  }
  return roster;
}

export function shortOrganizationId(id: string) {
  return id.length <= 8 ? id : id.slice(-8);
}
