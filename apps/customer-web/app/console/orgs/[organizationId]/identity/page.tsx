import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageWebSession } from "@/lib/page-session";
import { readOrganizationRoster } from "@/lib/organization-server";
import { RosterUnavailable } from "@/components/organizations/roster-unavailable";
import "../../../../aihub.css";
import "../../../../auth.css";

export const metadata: Metadata = { title: "User identity — AIHub" };
export const dynamic = "force-dynamic";

export default async function OrganizationIdentityPage({
  params,
  searchParams,
}: PageProps<"/console/orgs/[organizationId]/identity">) {
  const { organizationId } = await params;
  const query = await searchParams;
  const onboarding = query.onboarding === "1";
  const next = `/console/orgs/${encodeURIComponent(organizationId)}/identity${onboarding ? "?onboarding=1" : ""}`;
  const sessionId = await requirePageWebSession(next);
  const roster = await readOrganizationRoster(sessionId);
  if (!roster) return <RosterUnavailable />;
  const organization = roster.find((item) => item.id === organizationId);
  if (!organization) redirect("/console/orgs/denied");
  if (organization.status === "suspended")
    return (
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <h1 className="aihub-title">{organization.name}</h1>
          <p role="status">
            Organization đang tạm ngưng. Identity configuration chỉ có thể quản
            lý khi Organization hoạt động.
          </p>
          <Link href={`/console/orgs/${encodeURIComponent(organization.id)}`}>
            Quay lại Organization
          </Link>
        </div>
      </main>
    );
  if (organization.membershipRole === "owner")
    redirect(
      `/console/orgs/${encodeURIComponent(organization.id)}?identity=open${onboarding ? "&onboarding=1" : ""}`
    );
  return (
    <main className="aihub auth-page console-page">
      <div className="aihub-shell">
        <p className="aihub-eyebrow">AIHub Console · Organization</p>
        <h1 className="aihub-title">User identity</h1>
        <p className="aihub-lede">
          {organization.identityConfigured === false
            ? "Identity setup chưa hoàn tất. Nhờ owner cấu hình để bật user-scoped grading."
            : organization.identityConfigured === true
              ? "Organization đã lưu identity configuration đang hoạt động. Chỉ owner mới có thể xem hoặc quản lý chi tiết."
              : "Chỉ owner mới có thể xem hoặc quản lý identity configuration."}
        </p>
        <Link href={`/console/orgs/${encodeURIComponent(organization.id)}`}>
          Quay lại Organization
        </Link>
      </div>
    </main>
  );
}
