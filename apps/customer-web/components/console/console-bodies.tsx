"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ApiKeyManager } from "@/components/organizations/api-key-manager";
import { IdentityReadinessNotice } from "@/components/organizations/identity-readiness-notice";
import { OrganizationCreationForm } from "@/components/organizations/organization-creation-form";
import { OrganizationIdentityDialog } from "@/components/organizations/organization-identity-dialog";
import {
  canManageApiKeys,
  OrganizationHeader,
} from "@/components/organizations/organization-header";
import { OrganizationRenameForm } from "@/components/organizations/organization-rename-form";
import { RosterUnavailable } from "@/components/organizations/roster-unavailable";
import { RetryButton } from "@/components/retry-button";
import { SampleRequests } from "@/components/organizations/sample-requests";
import { SessionActivity } from "@/components/session-activity";
import { apiKeyEnvironmentLabel } from "@/lib/api-keys";
import { parseOrganizationApiKeyList } from "@/lib/api-keys";
import {
  membershipRoleLabel,
  organizationDestination,
  organizationLanding,
  organizationStatusLabel,
  parseOrganizationRoster,
  shortOrganizationId,
} from "@/lib/organizations";
import { hasQuickstart } from "@/lib/sample-request";
import { useDpopJson } from "@/components/console/use-dpop-json";

function useClientRedirect(path: string | null) {
  useEffect(() => {
    if (path) window.location.replace(path);
  }, [path]);
}

function useRoster() {
  const { data, loading } = useDpopJson<unknown>(
    "/app/api/organizations/me/members"
  );
  return {
    roster: loading ? undefined : parseOrganizationRoster(data),
    loading,
  };
}

export function ConsoleRedirectBody({ next }: { next: string }) {
  const { roster, loading } = useRoster();
  const destination =
    !loading && roster
      ? next
        ? next.replace(/^\/app(?=\/|$)/u, "")
        : roster.length < 2
          ? organizationLanding(roster)
          : "/console/orgs"
      : null;
  useClientRedirect(destination);
  if (loading) return null;
  if (!roster)
    return (
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <h1 className="aihub-title">Console</h1>
          <p className="aihub-lede" role="alert">
            Không thể tải Organization. Vui lòng thử lại.
          </p>
          <Link className="aihub-cta" href="/console">
            Thử lại
          </Link>
        </div>
      </main>
    );
  return null;
}

export function OrgsBody() {
  const { roster, loading } = useRoster();
  if (loading) return null;
  if (!roster) return <RosterUnavailable />;
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
    <>
      <SessionActivity />
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <p className="aihub-eyebrow">AIHub Console</p>
          <div className="organization-directory-heading">
            <div>
              <h1 className="aihub-title">Organizations</h1>
              <p className="aihub-lede">
                Quản lý Organization và mở workspace bạn cần.
              </p>
            </div>
            <OrganizationCreationForm />
          </div>
          {roster.length ? (
            <ul aria-label="Organizations" className="organization-directory">
              {roster.map((organization) => (
                <li key={organization.id}>
                  <Link href={organizationDestination(organization)}>
                    <span className="organization-directory-name">
                      {organization.name}
                      {duplicateNames.has(organization.id) && (
                        <span className="aihub-secondary">
                          {shortOrganizationId(organization.id)}
                        </span>
                      )}
                    </span>
                    <span className="organization-directory-meta">
                      <span>
                        {membershipRoleLabel(organization.membershipRole)}
                      </span>
                      <span>
                        {organizationStatusLabel(organization.status)}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="organization-directory-arrow"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="organization-directory-empty">
              Bạn chưa tham gia Organization nào. Tạo Organization để bắt đầu.
            </p>
          )}
        </div>
      </main>
    </>
  );
}

export function OrganizationBody({
  organizationId,
  identityOpen,
  onboarding,
}: {
  organizationId: string;
  identityOpen: boolean;
  onboarding: boolean;
}) {
  const { roster, loading } = useRoster();
  const organization = roster?.find((item) => item.id === organizationId);
  useClientRedirect(
    !loading && roster && !organization ? "/console/orgs/denied" : null
  );
  if (loading) return null;
  if (!roster) return <RosterUnavailable />;
  if (!organization) return null;
  const isActiveOwner =
    organization.status === "active" && organization.membershipRole === "owner";

  return (
    <>
      <SessionActivity />
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <OrganizationHeader
            organization={organization}
            roster={roster}
            section="overview"
          />
          {organization.status === "suspended" && (
            <p className="org-suspended" role="status">
              Organization đang tạm ngưng. Trang này chỉ hiển thị thông tin đọc.
            </p>
          )}
          <div className="org-cards">
            <section aria-labelledby="org-info-title" className="org-card">
              <div className="org-card-heading">
                <h2 id="org-info-title">Thông tin</h2>
                {isActiveOwner && (
                  <OrganizationRenameForm
                    name={organization.name}
                    organizationId={organization.id}
                  />
                )}
              </div>
              <dl className="org-facts">
                <div>
                  <dt>ID</dt>
                  <dd>
                    <code>{organization.id}</code>
                  </dd>
                </div>
                <div>
                  <dt>Dịch vụ được bật</dt>
                  <dd className="org-chips">
                    {organization.entitlements.length
                      ? organization.entitlements.map((entitlement) => (
                          <span className="org-chip" key={entitlement}>
                            {entitlement}
                          </span>
                        ))
                      : "Chưa có"}
                  </dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="org-identity-title" className="org-card">
              <h2 id="org-identity-title">Xác thực người dùng</h2>
              <IdentityReadinessNotice compact organization={organization} />
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
                    defaultOpen={identityOpen}
                    onboarding={onboarding}
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
        </div>
      </main>
    </>
  );
}

export function ApiKeysBody({ organizationId }: { organizationId: string }) {
  const { roster, loading } = useRoster();
  const organization = roster?.find((item) => item.id === organizationId);
  const denied =
    !loading &&
    (!organization ||
      organization.status !== "active" ||
      !["owner", "admin"].includes(organization.membershipRole));
  useClientRedirect(denied ? "/console/orgs/denied" : null);
  if (loading) return null;
  if (!roster) return <RosterUnavailable />;
  if (!organization || denied) return null;

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

export function IdentityBody({
  organizationId,
  onboarding,
}: {
  organizationId: string;
  onboarding: boolean;
}) {
  const { roster, loading } = useRoster();
  const organization = roster?.find((item) => item.id === organizationId);
  const ownerRedirect =
    !loading && organization?.membershipRole === "owner"
      ? `/console/orgs/${encodeURIComponent(organization.id)}?identity=open${onboarding ? "&onboarding=1" : ""}`
      : null;
  useClientRedirect(
    !loading && roster && !organization ? "/console/orgs/denied" : ownerRedirect
  );
  if (loading) return null;
  if (!roster) return <RosterUnavailable />;
  if (!organization || ownerRedirect) return null;
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

function ApiKeysUnavailable() {
  return (
    <main className="aihub auth-page console-page">
      <div className="aihub-shell">
        <h1 className="aihub-title">Không thể tải API keys</h1>
        <p className="aihub-lede">
          Chưa tải được danh sách API key của Organization. Key của bạn không bị
          ảnh hưởng.
        </p>
        <RetryButton />
      </div>
    </main>
  );
}

export function QuickstartBody({
  organizationId,
  apiKeyId,
}: {
  organizationId: string;
  apiKeyId: string;
}) {
  const { roster, loading: rosterLoading } = useRoster();
  const { data: keysData, loading: keysLoading } = useDpopJson<unknown>(
    `/app/api/organizations/${encodeURIComponent(organizationId)}/api-keys`
  );
  const ready = !rosterLoading && !keysLoading;
  const organization = roster?.find((item) => item.id === organizationId);
  const denied =
    ready &&
    (!organization ||
      organization.status !== "active" ||
      !["owner", "admin"].includes(organization.membershipRole));
  const apiKeys = ready ? parseOrganizationApiKeyList(keysData) : null;
  const apiKey = apiKeys?.find((key) => key.id === apiKeyId);
  const missingKey = ready && !!apiKeys && (!apiKey || !hasQuickstart(apiKey));
  useClientRedirect(
    denied ? "/console/orgs/denied" : missingKey ? "/console/orgs" : null
  );
  if (!ready) return null;
  if (!roster) return <RosterUnavailable />;
  if (!organization || denied) return null;
  if (!apiKeys) return <ApiKeysUnavailable />;
  if (!apiKey || missingKey) return null;
  const apiKeysPath = `/console/orgs/${encodeURIComponent(organizationId)}/api-keys`;

  return (
    <>
      <SessionActivity />
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <OrganizationHeader
            organization={organization}
            roster={roster}
            section="api-keys"
          />
          <nav aria-label="Breadcrumb" className="qs-breadcrumb">
            <Link href={apiKeysPath}>← API keys</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{apiKey.name}</span>
          </nav>
          <div className="qs-hero">
            <h2 className="qs-hero-title">{apiKey.name} · Quickstart</h2>
            <dl className="qs-facts">
              <div>
                <dt>Key prefix</dt>
                <dd>
                  <code>{apiKey.key_prefix}</code>
                </dd>
              </div>
              <div>
                <dt>Môi trường</dt>
                <dd>
                  {apiKey.allowed_environments.map((environment) => (
                    <span
                      className={`qs-env qs-env--${environment}`}
                      key={environment}
                    >
                      {apiKeyEnvironmentLabel(environment)}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt>Scopes</dt>
                <dd>
                  {apiKey.scopes.map((scope) => (
                    <code className="qs-scope" key={scope}>
                      {scope}
                    </code>
                  ))}
                </dd>
              </div>
            </dl>
            {!apiKey.scopes.includes("writing.exercise") && (
              <p className="qs-callout qs-callout--info">
                API key đã tạo giữ nguyên các scope ban đầu. Muốn gọi Writing
                exercise, hãy tạo key mới có scope <code>writing.exercise</code>
                .
              </p>
            )}
            {apiKey.scopes.includes("writing.exercise") && (
              <p className="qs-callout qs-callout--info">
                Quickstart hiện chưa có lệnh mẫu cho các API Writing exercise.
              </p>
            )}
          </div>
          <SampleRequests
            apiKey={apiKey}
            idempotencyKey={crypto.randomUUID()}
            identityConfigured={organization.identityConfigured}
          />
        </div>
      </main>
    </>
  );
}
