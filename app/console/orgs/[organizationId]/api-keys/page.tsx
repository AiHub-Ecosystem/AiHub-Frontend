import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePageWebSession } from "@/lib/page-session";
import { readOrganizationRoster } from "@/lib/organization-server";
import { SessionActivity } from "@/components/session-activity";
import { RosterUnavailable } from "@/components/organizations/roster-unavailable";
import { ApiKeyManager } from "@/components/organizations/api-key-manager";
import { IdentityReadinessNotice } from "@/components/organizations/identity-readiness-notice";
import { OrganizationIdentityDialog } from "@/components/organizations/organization-identity-dialog";
import { OrganizationHeader } from "@/components/organizations/organization-header";
import "../../../../aihub.css";
import "../../../../auth.css";
import "../../../../api-keys.css";
import "../../../../quickstart.css";
import "../../../../console.css";

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
          <OrganizationHeader
            actions={
              organization.membershipRole === "owner" && (
                <OrganizationIdentityDialog
                  organizationId={organization.id}
                  organizationName={organization.name}
                />
              )
            }
            organization={organization}
            roster={roster}
            section="api-keys"
          />
          <IdentityReadinessNotice organization={organization} />
          <ApiKeyManager
            entitlements={organization.entitlements}
            identityConfigured={organization.identityConfigured}
            organizationId={organization.id}
          />
        </div>
      </main>
    </>
  );
}
