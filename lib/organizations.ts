export type OrganizationMembership = {
  id: string;
  name: string;
  status: "active" | "suspended";
  membershipRole: "owner" | "admin" | "member";
  entitlements: string[];
  identityConfigured?: boolean;
};

/**
 * The pattern an Organization creation's idempotency key must match. The
 * browser mints the key once per attempt and repeats it on a retry, so the
 * rule lives in one place: the BFF, the Console form and the spike prototype
 * all read it from here.
 */
export const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validatedOrganizationName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  const length = [...name].length;
  return length >= 1 && length <= 100 ? name : null;
}

export function organizationDestination(organization: OrganizationMembership) {
  return `/console/orgs/${encodeURIComponent(organization.id)}`;
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

const MEMBERSHIP_ROLE_LABELS: Record<
  OrganizationMembership["membershipRole"],
  string
> = {
  owner: "Owner",
  admin: "Admin",
  member: "Thành viên",
};

export function membershipRoleLabel(
  role: OrganizationMembership["membershipRole"]
): string {
  return MEMBERSHIP_ROLE_LABELS[role];
}

/** Falls back to the raw status for one the Console does not name. */
export function organizationStatusLabel(status: string): string {
  return status === "active"
    ? "Đang hoạt động"
    : status === "suspended"
      ? "Tạm ngưng"
      : status;
}
