export type OrganizationMembership = {
  id: string;
  name: string;
  status: "active" | "suspended";
  membershipRole: "owner" | "admin" | "member";
  entitlements?: string[];
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
  if (roster.length === 0) return "/console/orgs/new";
  if (roster.length === 1) return organizationDestination(roster[0]);
  return "/console";
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
  const data = root?.data;
  if (!Array.isArray(data)) return null;
  const roster: OrganizationMembership[] = [];
  for (const item of data) {
    const row = record(item);
    const organization = record(row?.organization) ?? row;
    const id =
      organization?.id ?? organization?.organization_id ?? row?.organization_id;
    const name =
      organization?.name ??
      organization?.organization_name ??
      row?.organization_name;
    const status =
      organization?.status ??
      organization?.organization_status ??
      row?.organization_status;
    const rawEntitlements = organization?.entitlements;
    const membershipRole = row?.membership_role ?? row?.role;
    if (
      typeof id !== "string" ||
      !id ||
      typeof name !== "string" ||
      (status !== "active" && status !== "suspended") ||
      (membershipRole !== "owner" &&
        membershipRole !== "admin" &&
        membershipRole !== "member")
    )
      return null;
    if (
      rawEntitlements !== undefined &&
      (!Array.isArray(rawEntitlements) ||
        rawEntitlements.some((entitlement) => typeof entitlement !== "string"))
    )
      return null;
    roster.push({
      id,
      name,
      status,
      membershipRole,
      ...(Array.isArray(rawEntitlements)
        ? { entitlements: rawEntitlements as string[] }
        : {}),
    });
  }
  return roster;
}

export function shortOrganizationId(id: string) {
  return id.length <= 8 ? id : id.slice(-8);
}
