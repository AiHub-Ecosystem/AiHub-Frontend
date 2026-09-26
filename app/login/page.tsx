import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getCurrentWebSession,
  isWebSessionId,
  safeLocalPath,
  WEB_SESSION_COOKIE,
} from "@/lib/auth-session";
import { ClearStaleSession } from "@/components/clear-stale-session";
import { LoginForm } from "@/components/auth/login-form";
import "../aihub.css";
import "../auth.css";

export const metadata: Metadata = { title: "Đăng nhập — AIHub" };

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    retry?: string | string[];
    next?: string | string[];
    verified?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeLocalPath(
    typeof params.next === "string" ? params.next : null
  );
  const sessionId = (await cookies()).get(WEB_SESSION_COOKIE)?.value;
  let clearStaleCookie = !!sessionId && !isWebSessionId(sessionId);
  let hasActiveSession = false;
  if (isWebSessionId(sessionId)) {
    try {
      hasActiveSession = !!(await getCurrentWebSession(sessionId));
      clearStaleCookie = !hasActiveSession;
    } catch {
      // Redis is unavailable: keep the sign-in form usable and let login report failures safely.
    }
  }
  if (hasActiveSession) redirect(next);

  const retry =
    typeof params.retry === "string"
      ? Math.min(3600, Math.max(1, Number.parseInt(params.retry, 10) || 60))
      : 60;
  const error = typeof params.error === "string" ? params.error : undefined;
  const verified = params.verified === "1";

  return (
    <>
      {clearStaleCookie && <ClearStaleSession />}
      <main className="aihub auth-page">
        <div className="aihub-shell auth-shell">
          <section className="auth-card" aria-labelledby="login-title">
            <p className="aihub-eyebrow">AIHub Console</p>
            <h1 className="aihub-title" id="login-title">
              Đăng nhập
            </h1>
            <p className="aihub-lede">
              Đăng nhập bằng tài khoản AIHub của bạn để tiếp tục.
            </p>
            {verified && (
              <p className="aihub-lede" role="status">
                Email đã xác minh. Vui lòng đăng nhập.
              </p>
            )}
            <LoginForm next={next} error={error} retry={retry} />
          </section>
        </div>
      </main>
    </>
  );
}
