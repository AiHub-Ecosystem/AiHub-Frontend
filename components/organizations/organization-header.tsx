import Link from "next/link";
import type { ReactNode } from "react";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";
import {
  membershipRoleLabel,
  organizationStatusLabel,
  type OrganizationMembership,
} from "@/lib/organizations";

type OrganizationSection = "overview" | "api-keys";

/** Owners and admins of an active Organization manage its API keys. */
export function canManageApiKeys(organization: OrganizationMembership) {
  return (
    organization.status === "active" &&
    ["owner", "admin"].includes(organization.membershipRole)
  );
}

/**
 * The top of every page inside one Organization: who it is, the caller's
 * role in it, and the sections they can open.
 */
export function OrganizationHeader({
  organization,
  roster,
  section,
  actions,
}: {
  organization: OrganizationMembership;
  /** The caller's Organizations; with more than one, the header can switch. */
  roster: OrganizationMembership[];
  section: OrganizationSection;
  actions?: ReactNode;
}) {
  const base = `/console/orgs/${encodeURIComponent(organization.id)}`;
  const tabs: { section: OrganizationSection; label: string; href: string }[] =
    [
      { section: "overview", label: "Tổng quan", href: base },
      ...(canManageApiKeys(organization)
        ? [
            {
              section: "api-keys" as const,
              label: "API keys",
              href: `${base}/api-keys`,
            },
          ]
        : []),
    ];

  return (
    <div className="org-header">
      <Link className="organization-back-link" href="/console/orgs">
        ← Tất cả Organizations
      </Link>
      <div className="org-header-card">
        <div className="org-header-top">
          <div className="org-header-main">
            <p className="aihub-eyebrow">AIHub Console · Organization</p>
            <h1 className="aihub-title">{organization.name}</h1>
            <div className="org-badges">
              <span className="org-badge">
                Vai trò: {membershipRoleLabel(organization.membershipRole)}
              </span>
              <span className={`org-badge org-badge--${organization.status}`}>
                {organizationStatusLabel(organization.status)}
              </span>
            </div>
          </div>
          {(actions || roster.length > 1) && (
            <div className="org-header-actions">
              {actions}
              {roster.length > 1 && (
                <OrganizationSwitcher
                  roster={roster}
                  selectedId={organization.id}
                />
              )}
            </div>
          )}
        </div>
        {tabs.length > 1 && (
          <nav aria-label="Organization" className="org-tabs">
            {tabs.map((tab) => (
              <Link
                aria-current={tab.section === section ? "page" : undefined}
                className="org-tab"
                href={tab.href}
                key={tab.section}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
