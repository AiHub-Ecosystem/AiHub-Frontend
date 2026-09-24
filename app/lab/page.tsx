import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ClearStaleSession } from "@/components/clear-stale-session";
import { LoginForm } from "@/components/auth/login-form";
import { SessionActivity } from "@/components/session-activity";
import {
  getCurrentWebSession,
  isWebSessionId,
  WEB_SESSION_COOKIE,
} from "@/lib/auth-session";
import { getLoginErrorMessage } from "@/lib/auth-messages";
import { AcademicLabView } from "./academic-lab-view";
import "../aihub.css";
import "../auth.css";

export const metadata: Metadata = {
  title: "Academic Lab — AIHub Console",
  description: "Đăng nhập AIHub Console để truy cập Academic Lab.",
};
export const dynamic = "force-dynamic";

type LabPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    retry?: string | string[];
  }>;
};

export default async function LabPage({ searchParams }: LabPageProps) {
  const params = await searchParams;
  const sessionId = (await cookies()).get(WEB_SESSION_COOKIE)?.value;
  let clearStaleCookie = !!sessionId && !isWebSessionId(sessionId);
  let hasActiveSession = false;
  let sessionUnavailable = false;

  if (isWebSessionId(sessionId)) {
    try {
      hasActiveSession = !!(await getCurrentWebSession(sessionId));
      clearStaleCookie = !hasActiveSession;
    } catch {
      sessionUnavailable = true;
    }
  }

  if (hasActiveSession) {
    return (
      <>
        <SessionActivity />
        <AcademicLabView />
      </>
    );
  }

  const retry =
    typeof params.retry === "string"
      ? Math.min(3600, Math.max(1, Number.parseInt(params.retry, 10) || 60))
      : 60;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <>
      {clearStaleCookie && <ClearStaleSession />}
      <main className="hero hero-scene section lab-login-page">
        <div className="container lab-login-container">
          <section
            className="anim-lab-card lab-login-card"
            aria-labelledby="lab-login-title"
          >
            <div className="lab-login-accent" aria-hidden="true" />
            <div className="lab-login-heading">
              <p className="lab-login-eyebrow">AIHub Console · Academic Lab</p>
              <h1 id="lab-login-title">Đăng nhập để mở Academic Lab</h1>
              <p>
                Dùng tài khoản AIHub Console đã xác minh. Sau khi đăng nhập, bạn
                sẽ vào dashboard Console.
              </p>
            </div>

            <LoginForm
              next="/console"
              returnTo="/lab"
              error={error}
              retry={retry}
              unavailableMessage={
                sessionUnavailable
                  ? "Chưa thể kiểm tra phiên đăng nhập. Vui lòng thử lại sau."
                  : undefined
              }
              submitLabel="Đăng nhập AIHub Console"
              variant="lab"
            />

            <div className="lab-login-footer">
              <p>
                Chưa có tài khoản AIHub?{" "}
                <Link href="/register">Tạo tài khoản</Link>
              </p>
              <Link className="lab-login-back" href="/demo">
                ← Quay lại danh mục Demo
              </Link>
            </div>
          </section>
        </div>

        <div className="background-elements" aria-hidden="true">
          <div className="cloud-left ready show">
            <img
              src="/assets/img/clouds-1.webp"
              alt=""
              width={420}
              height={205}
            />
          </div>
          <div className="cloud-right ready show">
            <img
              src="/assets/img/clouds-2.webp"
              alt=""
              width={382}
              height={186}
            />
          </div>
          <div className="hero-castle ready show">
            <img
              src="/assets/img/hero-castle.webp"
              alt=""
              width={1137}
              height={710}
            />
          </div>
          <div className="hero-waterfall ready show">
            <img
              src="/assets/img/hero-waterfall.webp"
              alt=""
              width={800}
              height={710}
            />
          </div>
          <div className="hero-bg ready show">
            <img
              alt=""
              src="/meltano-mirror/next/static/media/Mountainsback.1bef34c0.svg"
              className="full-width-img"
              width={4000}
              height={286}
            />
          </div>
          <div className="hero-bg ready show">
            <img
              alt=""
              src="/meltano-mirror/next/static/media/Mountainsfront.f78aed9f.svg"
              className="full-width-img"
              width={4000}
              height={247}
            />
          </div>
        </div>
      </main>
    </>
  );
}
