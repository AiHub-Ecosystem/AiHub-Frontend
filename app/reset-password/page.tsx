import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import "../aihub.css";
import "../auth.css";

export const metadata: Metadata = { title: "Đặt mật khẩu mới — AIHub" };

export default function ResetPasswordPage() {
  return (
    <main className="aihub auth-page">
      <div className="aihub-shell auth-shell">
        <ResetPasswordForm />
      </div>
    </main>
  );
}
