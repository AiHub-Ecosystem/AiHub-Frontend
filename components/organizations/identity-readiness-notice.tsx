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
        <strong>Xác thực có chữ ký được khuyến nghị</strong>
        <p>
          Organization hiện dùng Declared User ID: bất kỳ ai có API key của
          Organization đều có thể gửi yêu cầu dưới ID của bất kỳ End-User nào mà
          không cần chữ ký. Có thể cấu hình identity để AIHUB xác minh Signed
          User Assertion.
        </p>
      </div>
      {organization.membershipRole === "owner" ? (
        <span>Bạn có thể mở Cấu hình identity để bật xác minh có chữ ký.</span>
      ) : (
        <span>Nhờ owner cấu hình identity để bật xác minh có chữ ký.</span>
      )}
    </aside>
  );
}
