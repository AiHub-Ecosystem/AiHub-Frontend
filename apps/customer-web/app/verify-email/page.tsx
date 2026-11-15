import type { Metadata } from "next";
import { VerifyEmail } from "@/components/auth/verify-email";
import "../aihub.css";
import "../auth.css";

export const metadata: Metadata = { title: "Xác minh email — AIHub" };

export default function VerifyEmailPage() {
  return (
    <main className="aihub auth-page">
      <div className="aihub-shell auth-shell">
        <VerifyEmail />
      </div>
    </main>
  );
}
