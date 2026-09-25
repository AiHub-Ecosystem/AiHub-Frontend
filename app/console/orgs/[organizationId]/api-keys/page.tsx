import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePageWebSession } from "@/lib/page-session";
import { readOrganizationRoster } from "@/lib/organization-server";
import { SessionActivity } from "@/components/session-activity";
import { RosterUnavailable } from "@/components/organizations/roster-unavailable";
import { ApiKeyManager } from "@/components/organizations/api-key-manager";
import { IdentityReadinessNotice } from "@/components/organizations/identity-readiness-notice";
import { OrganizationIdentityDialog } from "@/components/organizations/organization-identity-dialog";
import "../../../../aihub.css";
import "../../../../auth.css";
import "../../../../api-keys.css";

export const metadata: Metadata = { title: "API keys — AIHub" };
export const dynamic = "force-dynamic";

export default async function OrganizationApiKeysPage({
  params,
}: PageProps<"/console/orgs/[organizationId]/api-keys">) {
  const { organizationId } = await params;
  const next = `/console/orgs/${encodeURIComponent(organizationId)}/api-keys`;
  const sessionId = await requirePageWebSession(next);
  const roster = await readOrganizationRoster(sessionId);
  if (!roster) return <RosterUnavailable />;
  const organization = roster.find((item) => item.id === organizationId);
  if (
    !organization ||
    organization.status !== "active" ||
    !["owner", "admin"].includes(organization.membershipRole)
  )
    redirect("/console/orgs/denied");
  return (
    <>
      <SessionActivity />
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <p className="aihub-eyebrow">AIHub Console · Organization</p>
          <h1 className="aihub-title">{organization.name} · API keys</h1>
          <p className="aihub-lede">
            Tạo, xoay và thu hồi API keys dùng để kết nối dịch vụ của
            Organization.
          </p>
          <Link className="organization-back-link" href="/console/orgs">
            ← Tất cả Organizations
          </Link>
          {organization.membershipRole === "owner" && (
            <OrganizationIdentityDialog
              organizationId={organization.id}
              organizationName={organization.name}
            />
          )}
          <IdentityReadinessNotice organization={organization} />
          <ApiKeyManager
            entitlements={organization.entitlements}
            organizationId={organization.id}
          />
        </div>
      </main>
    </>
  );
}
