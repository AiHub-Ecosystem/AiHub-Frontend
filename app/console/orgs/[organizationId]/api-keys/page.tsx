import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentWebSession, WEB_SESSION_COOKIE } from "@/lib/auth-session";
import { readOrganizationRoster } from "@/lib/organization-server";
import { SessionActivity } from "@/components/session-activity";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";
import { RosterUnavailable } from "@/components/organizations/roster-unavailable";
import "../../../../aihub.css";
import "../../../../auth.css";

export const metadata: Metadata = { title: "API keys — AIHub" };
export const dynamic = "force-dynamic";

export default async function OrganizationApiKeysPage({
  params,
}: PageProps<"/console/orgs/[organizationId]/api-keys">) {
  const { organizationId } = await params;
  const next = `/console/orgs/${encodeURIComponent(organizationId)}/api-keys`;
  const sessionId = (await cookies()).get(WEB_SESSION_COOKIE)?.value;
  if (!sessionId) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!(await getCurrentWebSession(sessionId)))
    redirect(`/login?error=session&next=${encodeURIComponent(next)}`);
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
            Trang API keys của Organization. Quản lý API keys sẽ có trong phần
            tiếp theo.
          </p>
          <p>Membership Role: {organization.membershipRole}</p>
          <OrganizationSwitcher roster={roster} selectedId={organization.id} />
        </div>
      </main>
    </>
  );
}
