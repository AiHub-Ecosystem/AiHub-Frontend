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
import {
  canManageApiKeys,
  OrganizationHeader,
} from "@/components/organizations/organization-header";
import "../../../aihub.css";
import "../../../auth.css";
import "../../../console.css";

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
  const isActiveOwner =
    organization.status === "active" && organization.membershipRole === "owner";
  const otherOrganizations = roster.filter(
    (item) => item.id !== organization.id
  );
  return (
    <>
      <SessionActivity />
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <OrganizationHeader organization={organization} section="overview" />
          {organization.status === "suspended" && (
            <p className="org-suspended" role="status">
              Organization đang tạm ngưng. Trang này chỉ hiển thị thông tin đọc.
            </p>
          )}
          <div className="org-cards">
            <section aria-labelledby="org-info-title" className="org-card">
              <h2 id="org-info-title">Thông tin</h2>
              <dl className="org-facts">
                <div>
                  <dt>Tên</dt>
                  <dd>{organization.name}</dd>
                </div>
                <div>
                  <dt>ID</dt>
                  <dd>
                    <code>{organization.id}</code>
                  </dd>
                </div>
                <div>
                  <dt>Dịch vụ được bật</dt>
                  <dd>
                    {organization.entitlements.length
                      ? organization.entitlements.join(", ")
                      : "Chưa có"}
                  </dd>
                </div>
              </dl>
              {isActiveOwner && (
                <div className="org-card-actions">
                  <OrganizationRenameForm
                    name={organization.name}
                    organizationId={organization.id}
                  />
                </div>
              )}
            </section>

            <section aria-labelledby="org-identity-title" className="org-card">
              <h2 id="org-identity-title">Xác thực người dùng</h2>
              <IdentityReadinessNotice organization={organization} />
              {organization.identityConfigured === true && (
                <p className="org-card-text">
                  <span className="org-dot org-dot--ok" aria-hidden="true" />
                  Đã bật xác minh Signed User Assertion.
                </p>
              )}
              {organization.identityConfigured === undefined && (
                <p className="org-card-text">
                  Cấu hình issuer và JWKS để AIHUB xác minh User Assertion có
                  chữ ký.
                </p>
              )}
              {isActiveOwner && (
                <div className="org-card-actions">
                  <OrganizationIdentityDialog
                    defaultOpen={query.identity === "open"}
                    onboarding={query.onboarding === "1"}
                    organizationId={organization.id}
                    organizationName={organization.name}
                  />
                </div>
              )}
            </section>

            <section aria-labelledby="org-keys-title" className="org-card">
              <h2 id="org-keys-title">API keys</h2>
              <p className="org-card-text">
                Key để backend của bạn gọi AIHUB. Tạo, xoay, thu hồi key và gọi
                thử từng key.
              </p>
              {canManageApiKeys(organization) ? (
                <div className="org-card-actions">
                  <Link
                    className="auth-submit org-card-primary"
                    href={`/console/orgs/${encodeURIComponent(organization.id)}/api-keys`}
                  >
                    Quản lý API keys
                  </Link>
                </div>
              ) : (
                <p className="org-card-text org-card-muted">
                  Chỉ owner hoặc admin của Organization đang hoạt động quản lý
                  được API keys.
                </p>
              )}
            </section>
          </div>
          {otherOrganizations.length > 0 && (
            <OrganizationSwitcher
              roster={roster}
              selectedId={organization.id}
              showCreate={false}
            />
          )}
        </div>
      </main>
    </>
  );
}
