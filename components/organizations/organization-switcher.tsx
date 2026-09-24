import Link from "next/link";
import {
  organizationDestination,
  shortOrganizationId,
  type OrganizationMembership,
} from "@/lib/organizations";

export function OrganizationSwitcher({
  roster,
  selectedId,
}: {
  roster: OrganizationMembership[];
  selectedId?: string;
}) {
  const duplicateNames = new Set(
    roster
      .filter((organization, index) =>
        roster.some(
          (other, otherIndex) =>
            index !== otherIndex &&
            other.name.trim().toLocaleLowerCase() ===
              organization.name.trim().toLocaleLowerCase()
        )
      )
      .map((organization) => organization.id)
  );

  return (
    <nav aria-label="Organizations" className="organization-switcher">
      <span className="aihub-secondary">Organizations</span>
      {roster.map((organization) => (
        <Link
          aria-current={organization.id === selectedId ? "page" : undefined}
          href={organizationDestination(organization)}
          key={organization.id}
        >
          <span>{organization.name}</span>
          {duplicateNames.has(organization.id) && (
            <span className="aihub-secondary">
              {shortOrganizationId(organization.id)}
            </span>
          )}
          <span className="aihub-secondary">
            {organization.membershipRole} · {organization.status}
          </span>
        </Link>
      ))}
      <Link href="/console/orgs/new">Tạo Organization mới</Link>
    </nav>
  );
}
