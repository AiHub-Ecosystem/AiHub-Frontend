import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageWebSession } from "@/lib/page-session";
import { readOrganizationRoster } from "@/lib/organization-server";
import { SessionActivity } from "@/components/session-activity";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";
import { OrganizationRenameForm } from "@/components/organizations/organization-rename-form";
import { RosterUnavailable } from "@/components/organizations/roster-unavailable";
import { IdentityReadinessNotice } from "@/components/organizations/identity-readiness-notice";
import { OrganizationIdentityDialog } from "@/components/organizations/organization-identity-dialog";
import "../../../aihub.css";
import "../../../auth.css";

export const metadata: Metadata = { title: "Organization — AIHub" };
export const dynamic = "force-dynamic";

export default async function OrganizationOverviewPage({
  params,
  searchParams,
}: PageProps<"/console/orgs/[organizationId]">) {
  const { organizationId } = await params;
  const query = await searchParams;
  const next = `/console/orgs/${encodeURIComponent(organizationId)}`;
  const sessionId = await requirePageWebSession(next);
  const roster = await readOrganizationRoster(sessionId);
  if (!roster) return <RosterUnavailable />;
  const organization = roster.find((item) => item.id === organizationId);
  if (!organization) redirect("/console/orgs/denied");
  return (
    <>
      <SessionActivity />
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <p className="aihub-eyebrow">AIHub Console · Organization</p>
          <h1 className="aihub-title">{organization.name}</h1>
          <p className="aihub-lede">
            Trạng thái: {organization.status} · Membership Role:{" "}
            {organization.membershipRole}
          </p>
          {organization.status === "suspended" && (
            <p role="status">
              Organization đang tạm ngưng. Trang này chỉ hiển thị thông tin đọc.
            </p>
          )}
          <IdentityReadinessNotice organization={organization} />
          {organization.status === "active" &&
            organization.membershipRole === "owner" && (
              <div className="organization-actions">
                <OrganizationIdentityDialog
                  defaultOpen={query.identity === "open"}
                  onboarding={query.onboarding === "1"}
                  organizationId={organization.id}
                  organizationName={organization.name}
                />
                <Link
                  className="organization-back-link"
                  href={`/console/orgs/${encodeURIComponent(organization.id)}/api-keys`}
                >
                  Quản lý API keys
                </Link>
              </div>
            )}
          {organization.status === "active" &&
            organization.membershipRole === "admin" && (
              <Link
                className="organization-back-link"
                href={`/console/orgs/${encodeURIComponent(organization.id)}/api-keys`}
              >
                Quản lý API keys
              </Link>
            )}
          {organization.status === "active" &&
            organization.membershipRole === "owner" && (
              <OrganizationRenameForm
                organizationId={organization.id}
                name={organization.name}
              />
            )}
          <OrganizationSwitcher
            roster={roster}
            selectedId={organization.id}
            showCreate={false}
          />
        </div>
      </main>
    </>
  );
}
