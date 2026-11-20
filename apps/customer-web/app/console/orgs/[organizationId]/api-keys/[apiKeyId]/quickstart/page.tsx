import type { Metadata } from "next";
import { requirePageWebSession } from "@/lib/page-session";
import { quickstartPath } from "@/lib/sample-request";
import { QuickstartBody } from "@/components/console/console-bodies";
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
  await requirePageWebSession(quickstartPath(organizationId, apiKeyId));
  return <QuickstartBody organizationId={organizationId} apiKeyId={apiKeyId} />;
}
