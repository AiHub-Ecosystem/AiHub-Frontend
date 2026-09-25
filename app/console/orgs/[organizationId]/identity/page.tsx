import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OrganizationIdentityForm } from "@/components/organizations/organization-identity-form";
import { requirePageWebSession } from "@/lib/page-session";
import { readOrganizationIdentityConfig } from "@/lib/organization-identity-server";
import { readOrganizationRoster } from "@/lib/organization-server";
import { RosterUnavailable } from "@/components/organizations/roster-unavailable";
import { SessionActivity } from "@/components/session-activity";
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
  if (organization.membershipRole !== "owner")
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

  const { config, forbidden, unavailable } =
    await readOrganizationIdentityConfig(sessionId, organization.id);
  if (forbidden) {
    const refreshedRoster = await readOrganizationRoster(sessionId);
    const refreshed = refreshedRoster?.find(
      (item) => item.id === organizationId
    );
    return (
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <h1 className="aihub-title">User identity</h1>
          <p className="identity-safe-notice" role="status">
            Quyền truy cập identity configuration đã thay đổi. Không có issuer
            hoặc JWKS nào được hiển thị.
          </p>
          <p>
            {refreshed?.membershipRole ?? organization.membershipRole} ·{" "}
            {refreshed?.status ?? organization.status}
          </p>
          <Link href={`/console/orgs/${encodeURIComponent(organization.id)}`}>
            Quay lại Organization
          </Link>
        </div>
      </main>
    );
  }
  if (unavailable || !config)
    return (
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <h1 className="aihub-title">User identity</h1>
          <p className="identity-safe-notice" role="alert">
            Không thể tải identity configuration. Hãy thử tải lại trang.
          </p>
          <Link href={`/console/orgs/${encodeURIComponent(organization.id)}`}>
            Quay lại Organization
          </Link>
        </div>
      </main>
    );
  return (
    <>
      <SessionActivity />
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <p className="aihub-eyebrow">AIHub Console · Organization</p>
          <h1 className="aihub-title">User identity</h1>
          <p className="aihub-lede">
            Thiết lập cách AIHUB xác minh User Assertions của Organization.
          </p>
          <Link
            className="organization-back-link"
            href={`/console/orgs/${encodeURIComponent(organization.id)}`}
          >
            ← {organization.name}
          </Link>
          <OrganizationIdentityForm
            organizationId={organization.id}
            initialConfig={config}
            onboarding={onboarding}
          />
        </div>
      </main>
    </>
  );
}
