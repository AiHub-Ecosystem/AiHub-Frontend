import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageWebSession } from "@/lib/page-session";
import { safeLocalPath } from "@/lib/auth-session";
import { readOrganizationRoster } from "@/lib/organization-server";
import { organizationLanding } from "@/lib/organizations";
import { SessionActivity } from "@/components/session-activity";
import "../aihub.css";
import "../auth.css";

export const metadata: Metadata = { title: "Console — AIHub" };
export const dynamic = "force-dynamic";

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const sessionId = await requirePageWebSession("/console");

  const nextValue = (await searchParams).next;
  const next = safeLocalPath(
    typeof nextValue === "string" ? nextValue : null,
    ""
  );
  if (next && next !== "/console") redirect(next);

  const roster = await readOrganizationRoster(sessionId);
  if (!roster) {
    return (
      <>
        <SessionActivity />
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
      </>
    );
  }
  if (roster.length < 2) redirect(organizationLanding(roster));
  redirect("/console/orgs");
}
