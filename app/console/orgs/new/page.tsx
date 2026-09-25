import type { Metadata } from "next";
import { requirePageWebSession } from "@/lib/page-session";
import { readOrganizationRoster } from "@/lib/organization-server";
import { SessionActivity } from "@/components/session-activity";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";
import { OrganizationCreationForm } from "@/components/organizations/organization-creation-form";
import "../../../aihub.css";
import "../../../auth.css";

export const metadata: Metadata = { title: "Tạo Organization — AIHub" };
export const dynamic = "force-dynamic";

export default async function NewOrganizationPage() {
  const sessionId = await requirePageWebSession("/console/orgs/new");
  const roster = await readOrganizationRoster(sessionId);
  return (
    <>
      <SessionActivity />
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <p className="aihub-eyebrow">AIHub Console</p>
          <h1 className="aihub-title">Tạo Organization</h1>
          <p className="aihub-lede">
            Tự tạo Organization để dùng dịch vụ Writing với 100 lượt yêu cầu mỗi
            tháng, tự động dừng khi hết hạn mức, tối đa 60 lượt mỗi phút và 5
            lượt đồng thời.
          </p>
          <p className="aihub-lede">
            Mỗi User Account được tạo tối đa 3 Organization trong suốt thời gian
            sử dụng. Liên hệ AIHUB nếu cần thêm.
          </p>
          <OrganizationCreationForm openOnMount />
          {roster && (
            <OrganizationSwitcher roster={roster} showCreate={false} />
          )}
        </div>
      </main>
    </>
  );
}
