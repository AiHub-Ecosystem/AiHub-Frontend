import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentWebSession, WEB_SESSION_COOKIE } from "@/lib/auth-session";
import { readOrganizationRoster } from "@/lib/organization-server";
import { SessionActivity } from "@/components/session-activity";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";
import { OrganizationCreationForm } from "@/components/organizations/organization-creation-form";
import "../../../aihub.css";
import "../../../auth.css";

export const metadata: Metadata = { title: "Tạo Organization — AIHub" };
export const dynamic = "force-dynamic";

export default async function NewOrganizationPage() {
  const sessionId = (await cookies()).get(WEB_SESSION_COOKIE)?.value;
  if (!sessionId) redirect("/login?next=%2Fconsole%2Forgs%2Fnew");
  if (!(await getCurrentWebSession(sessionId)))
    redirect("/login?error=session&next=%2Fconsole%2Forgs%2Fnew");
  const roster = await readOrganizationRoster(sessionId);
  return (
    <>
      <SessionActivity />
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <p className="aihub-eyebrow">AIHub Console</p>
          <h1 className="aihub-title">Tạo Organization</h1>
          <p className="aihub-lede">
            Self-serve Organization dùng dịch vụ Writing, gồm 100 requests mỗi
            tháng với hard stop, 60 requests mỗi phút và tối đa 5 requests đồng
            thời.
          </p>
          <p className="aihub-lede">
            Mỗi User Account được tạo tối đa 3 Organization trong suốt thời gian
            sử dụng. Liên hệ AIHUB nếu cần thêm.
          </p>
          <OrganizationCreationForm />
          {roster && <OrganizationSwitcher roster={roster} />}
        </div>
      </main>
    </>
  );
}
