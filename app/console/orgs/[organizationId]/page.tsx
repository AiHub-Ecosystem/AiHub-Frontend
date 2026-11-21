import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageWebSession } from "@/lib/page-session";
import { readOrganizationRoster } from "@/lib/organization-server";
import { SessionActivity } from "@/components/session-activity";
import { RosterUnavailable } from "@/components/organizations/roster-unavailable";
import { ConsoleWorkbench } from "../../console-workbench";
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
  return (
    <>
      <SessionActivity />
      <ConsoleWorkbench />
    </>
  );
}
