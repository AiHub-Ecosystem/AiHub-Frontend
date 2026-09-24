import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getWebSession,
  isWebSessionId,
  safeLocalPath,
  WEB_SESSION_COOKIE,
} from "@/lib/auth-session";
import { ClearStaleSession } from "@/components/clear-stale-session";
import "../aihub.css";
import "../auth.css";

export const metadata: Metadata = { title: "Đăng nhập — AIHub" };

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    retry?: string | string[];
    next?: string | string[];
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
      hasActiveSession = !!(await getWebSession(sessionId));
      clearStaleCookie = !hasActiveSession;
    } catch {
      // Redis is unavailable: keep the sign-in form usable and let login report failures safely.
    }
  }
  if (hasActiveSession) redirect(next);

  const error = typeof params.error === "string" ? params.error : "";
  const retry =
    typeof params.retry === "string"
      ? Math.min(3600, Math.max(1, Number.parseInt(params.retry, 10) || 60))
      : 60;
  const message =
    error === "invalid"
      ? "Email hoặc mật khẩu không đúng."
      : error === "rate-limited"
        ? `Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ${retry} giây.`
        : error === "unavailable"
          ? "Hiện chưa thể đăng nhập. Vui lòng thử lại sau."
          : error === "session"
            ? "Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại."
            : null;

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
            <form action="/api/auth/login" method="post" className="auth-form">
              <input type="hidden" name="next" value={next} />
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                maxLength={320}
                required
              />
              <label htmlFor="password">Mật khẩu</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={256}
                required
              />
              {message && (
                <p className="auth-error" role="alert">
                  {message}
                </p>
              )}
              <button className="auth-submit" type="submit">
                Đăng nhập
              </button>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
