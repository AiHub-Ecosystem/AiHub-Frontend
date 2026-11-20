import type { Metadata } from "next";
import { requirePageWebSession } from "@/lib/page-session";
import { OrganizationBody } from "@/components/console/console-bodies";
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
  await requirePageWebSession(
    `/console/orgs/${encodeURIComponent(organizationId)}`
  );
  return (
    <OrganizationBody
      organizationId={organizationId}
      identityOpen={query.identity === "open"}
      onboarding={query.onboarding === "1"}
    />
  );
}
