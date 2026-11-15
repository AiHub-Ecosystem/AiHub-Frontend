import type { OrganizationMembership } from "@/lib/organizations";

export function IdentityReadinessNotice({
  organization,
  compact = false,
}: {
  organization: OrganizationMembership;
  /** One sentence, for a card that already sits beside the identity action. */
  compact?: boolean;
}) {
  if (
    organization.status !== "active" ||
    organization.identityConfigured !== false
  )
    return null;
  return (
    <aside className="identity-readiness" role="status">
      <div>
        <strong>Xác thực có chữ ký là tùy chọn</strong>
        {compact ? (
          <p>
            Đang dùng Declared User ID: vẫn chấm được, nhưng ai có API key cũng
            gửi được yêu cầu dưới ID của End-User bất kỳ.
          </p>
        ) : (
          <p>
            Organization hiện dùng Declared User ID nên vẫn chấm được mà không
            cần cấu hình identity. Đổi lại, bất kỳ ai có API key của
            Organization đều có thể gửi yêu cầu dưới ID của bất kỳ End-User nào
            mà không cần chữ ký. Nếu bạn muốn AIHUB xác minh Signed User
            Assertion, hãy thiết lập identity.
          </p>
        )}
      </div>
      {organization.membershipRole !== "owner" ? (
        <span>Nhờ owner cấu hình identity để bật xác minh có chữ ký.</span>
      ) : (
        // A compact note sits right above the owner's identity button.
        !compact && (
          <span>
            Bạn có thể mở Cấu hình identity để bật xác minh có chữ ký.
          </span>
        )
      )}
    </aside>
  );
}
