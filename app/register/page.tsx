import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import "../aihub.css";
import "../auth.css";

export const metadata: Metadata = { title: "Đăng ký — AIHub" };

export default function RegisterPage() {
  return (
    <main className="aihub auth-page">
      <div className="aihub-shell auth-shell">
        <RegisterForm />
      </div>
    </main>
  );
}
