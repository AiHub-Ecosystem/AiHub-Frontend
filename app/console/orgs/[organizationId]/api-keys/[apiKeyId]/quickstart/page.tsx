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
import { hasQuickstart } from "@/lib/sample-request";
import { SessionActivity } from "@/components/session-activity";
import { RosterUnavailable } from "@/components/organizations/roster-unavailable";
import { SampleRequests } from "@/components/organizations/sample-requests";
import "../../../../../../aihub.css";
import "../../../../../../auth.css";
import "../../../../../../api-keys.css";

export const metadata: Metadata = { title: "Quickstart — AIHub" };
export const dynamic = "force-dynamic";

export default async function ApiKeyQuickstartPage({
  params,
}: PageProps<"/console/orgs/[organizationId]/api-keys/[apiKeyId]/quickstart">) {
  const { organizationId, apiKeyId } = await params;
  const apiKeysPath = `/console/orgs/${encodeURIComponent(organizationId)}/api-keys`;
  const sessionId = await requirePageWebSession(
    `${apiKeysPath}/${encodeURIComponent(apiKeyId)}/quickstart`
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
          <p className="aihub-eyebrow">AIHub Console · {organization.name}</p>
          <h1 className="aihub-title">{apiKey.name} · Quickstart</h1>
          <dl className="api-key-quickstart-meta">
            <dt>Key prefix</dt>
            <dd>
              <code>{apiKey.key_prefix}</code>
            </dd>
            <dt>Môi trường</dt>
            <dd>
              {apiKey.allowed_environments
                .map(apiKeyEnvironmentLabel)
                .join(", ")}
            </dd>
            <dt>Scopes</dt>
            <dd>{apiKey.scopes.join(", ")}</dd>
          </dl>
          <div className="api-key-page-actions">
            <Link className="organization-back-link" href={apiKeysPath}>
              ← API keys
            </Link>
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
        <a href="">Thử lại</a>
      </div>
    </main>
  );
}
