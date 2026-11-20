import type { Metadata } from "next";
import { requirePageWebSession } from "@/lib/page-session";
import { IdentityBody } from "@/components/console/console-bodies";
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
  await requirePageWebSession(
    `/console/orgs/${encodeURIComponent(organizationId)}/identity${onboarding ? "?onboarding=1" : ""}`
  );
  return (
    <IdentityBody organizationId={organizationId} onboarding={onboarding} />
  );
}
