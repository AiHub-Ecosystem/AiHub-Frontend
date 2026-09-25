import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentWebSession, WEB_SESSION_COOKIE } from "@/lib/auth-session";
import { safeLocalPath } from "@/lib/auth-session";
import { readOrganizationRoster } from "@/lib/organization-server";
import { organizationLanding } from "@/lib/organizations";
import { SessionActivity } from "@/components/session-activity";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";
import "../aihub.css";
import "../auth.css";

export const metadata: Metadata = { title: "Console — AIHub" };
export const dynamic = "force-dynamic";

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const sessionId = (await cookies()).get(WEB_SESSION_COOKIE)?.value;
  if (!sessionId) redirect("/login?next=%2Fconsole");

  const session = await getCurrentWebSession(sessionId);
  if (!session) redirect("/login?error=session&next=%2Fconsole");

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

  return (
    <>
      <SessionActivity />
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <p className="aihub-eyebrow">AIHub</p>
          <h1 className="aihub-title">Chọn Organization</h1>
          <p className="aihub-lede">Chọn Organization để mở Console.</p>
          <OrganizationSwitcher roster={roster} />
        </div>
      </main>
    </>
  );
}
