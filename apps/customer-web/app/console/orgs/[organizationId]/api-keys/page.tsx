import type { Metadata } from "next";
import { requirePageWebSession } from "@/lib/page-session";
import { ApiKeysBody } from "@/components/console/console-bodies";
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
  await requirePageWebSession(
    `/console/orgs/${encodeURIComponent(organizationId)}/api-keys`
  );
  return <ApiKeysBody organizationId={organizationId} />;
}
