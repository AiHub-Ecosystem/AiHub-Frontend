import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageWebSession } from "@/lib/page-session";
import {
  readOrganizationApiKeys,
  readOrganizationRoster,
} from "@/lib/organization-server";
import { apiKeyEnvironmentLabel } from "@/lib/api-keys";
import { hasQuickstart, quickstartPath } from "@/lib/sample-request";
import { RetryButton } from "@/components/retry-button";
import { SessionActivity } from "@/components/session-activity";
import { RosterUnavailable } from "@/components/organizations/roster-unavailable";
import { SampleRequests } from "@/components/organizations/sample-requests";
import { OrganizationHeader } from "@/components/organizations/organization-header";
import "../../../../../../aihub.css";
import "../../../../../../auth.css";
import "../../../../../../api-keys.css";
import "../../../../../../quickstart.css";
import "../../../../../../console.css";

export const metadata: Metadata = { title: "Quickstart — AIHub" };
export const dynamic = "force-dynamic";

export default async function ApiKeyQuickstartPage({
  params,
}: PageProps<"/console/orgs/[organizationId]/api-keys/[apiKeyId]/quickstart">) {
  const { organizationId, apiKeyId } = await params;
  const apiKeysPath = `/console/orgs/${encodeURIComponent(organizationId)}/api-keys`;
  const sessionId = await requirePageWebSession(
    quickstartPath(organizationId, apiKeyId)
  );
  const roster = await readOrganizationRoster(sessionId);
  if (!roster) return <RosterUnavailable />;
  const organization = roster.find((item) => item.id === organizationId);
  if (
    !organization ||
    organization.status !== "active" ||
    !["owner", "admin"].includes(organization.membershipRole)
  )
    redirect("/console/orgs/denied");

  const apiKeys = await readOrganizationApiKeys(sessionId, organization.id);
  if (!apiKeys) return <ApiKeysUnavailable />;
  // The backend omits revoked keys, so a revoked or rotated-away id is absent.
  const apiKey = apiKeys.find((key) => key.id === apiKeyId);
  if (!apiKey || !hasQuickstart(apiKey)) notFound();

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
          </div>
          <SampleRequests
            apiKey={apiKey}
            idempotencyKey={randomUUID()}
            identityConfigured={organization.identityConfigured}
          />
        </div>
      </main>
    </>
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
