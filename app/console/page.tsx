import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentWebSession, WEB_SESSION_COOKIE } from "@/lib/auth-session";
import { SessionActivity } from "@/components/session-activity";
import "../aihub.css";
import "../auth.css";

export const metadata: Metadata = { title: "Console — AIHub" };
export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const sessionId = (await cookies()).get(WEB_SESSION_COOKIE)?.value;
  if (!sessionId) redirect("/login?next=%2Fconsole");

  const session = await getCurrentWebSession(sessionId);
  if (!session) redirect("/login?error=session&next=%2Fconsole");

  return (
    <>
      <SessionActivity />
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <p className="aihub-eyebrow">AIHub</p>
          <h1 className="aihub-title">Console</h1>
          <p className="aihub-lede">
            Quản lý tài khoản AIHub và mở các công cụ dành cho đội ngũ.
          </p>
          <div className="aihub-grid" style={{ marginTop: 32 }}>
            <Link className="aihub-card" href="/lab">
              <h2 className="aihub-card-name">Academic Lab</h2>
              <p className="aihub-card-desc">
                Tạo bài tập, duyệt mẫu học thuật và theo dõi các API.
              </p>
              <span className="aihub-cta">Mở Academic Lab →</span>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
