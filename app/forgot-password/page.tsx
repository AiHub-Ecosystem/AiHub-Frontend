import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import "../aihub.css";
import "../auth.css";

export const metadata: Metadata = { title: "Quên mật khẩu — AIHub" };

export default function ForgotPasswordPage() {
  return (
    <main className="aihub auth-page">
      <div className="aihub-shell auth-shell">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
