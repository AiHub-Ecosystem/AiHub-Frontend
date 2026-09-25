import type { OrganizationMembership } from "@/lib/organizations";

export function IdentityReadinessNotice({
  organization,
}: {
  organization: OrganizationMembership;
}) {
  if (
    organization.status !== "active" ||
    organization.identityConfigured !== false
  )
    return null;
  return (
    <aside className="identity-readiness" role="status">
      <div>
        <strong>Identity setup chưa hoàn tất</strong>
        <p>
          User-scoped grading cần Organization có identity configuration đang
          hoạt động. Nếu API trả <code>IDENTITY_CONFIG_REQUIRED</code>, owner có
          thể hoàn tất thiết lập tại đây.
        </p>
      </div>
      {organization.membershipRole === "owner" ? (
        <span>Bạn có thể mở Cấu hình identity để hoàn tất thiết lập.</span>
      ) : (
        <span>Nhờ owner hoàn tất thiết lập này.</span>
      )}
    </aside>
  );
}
