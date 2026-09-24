"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

type AuthError = { code?: unknown; retry_after_seconds?: unknown };
const RESEND_ACCEPTED =
  "Nếu địa chỉ email này có User Account, chúng tôi sẽ gửi hướng dẫn phù hợp.";

function boundedRetry(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(3600, Math.max(1, Math.ceil(value)))
    : 60;
}

export function VerifyEmail() {
  const started = useRef(false);
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<
    "loading" | "success" | "recovery" | "retry"
  >("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryUntil, setRetryUntil] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!retryUntil) return;
    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((retryUntil - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
      if (!remaining) setRetryUntil(0);
    };
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [retryUntil]);

  const verify = useCallback(async (value: string) => {
    setPhase("loading");
    setMessage("");
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value }),
      });
      if (response.status === 204) {
        setToken("");
        setPhase("success");
        return;
      }
      const body = await response.json().catch(() => ({}));
      const error = (body as { error?: AuthError }).error;
      if (error?.code === "AUTH_VERIFICATION_TOKEN_INVALID") {
        setToken("");
        setPhase("recovery");
        setMessage(
          "Liên kết xác minh không hợp lệ hoặc đã hết hạn. Nhập email để nhận hướng dẫn mới."
        );
      } else if (error?.code === "RATE_LIMITED") {
        const delay = boundedRetry(error.retry_after_seconds);
        setRetryUntil(Date.now() + delay * 1000);
        setSecondsLeft(delay);
        setPhase("retry");
        setMessage(
          `Bạn đã thử quá nhiều lần. Vui lòng thử xác minh lại sau ${delay} giây.`
        );
      } else {
        setPhase("retry");
        setMessage(
          "Hiện chưa thể xác minh email. Bạn có thể thử lại hoặc yêu cầu email mới."
        );
      }
    } catch {
      setPhase("retry");
      setMessage(
        "Hiện chưa thể xác minh email. Bạn có thể thử lại hoặc yêu cầu email mới."
      );
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const current = new URL(window.location.href);
    const value = current.searchParams.get("token") ?? "";
    window.history.replaceState(window.history.state, "", current.pathname);
    if (!value) {
      // The recovery state depends on the browser URL, which is only available after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("recovery");
      setMessage(
        "Liên kết xác minh không hợp lệ hoặc đã hết hạn. Nhập email để nhận hướng dẫn mới."
      );
      return;
    }
    // The token is read after hydration, scrubbed from history, then submitted from memory.
    setToken(value);
    void verify(value);
  }, [verify]);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json().catch(() => ({}));
      const error = (body as { error?: AuthError }).error;
      if (response.status === 202) {
        setMessage(RESEND_ACCEPTED);
      } else if (error?.code === "RATE_LIMITED") {
        const delay = boundedRetry(error.retry_after_seconds);
        setRetryUntil(Date.now() + delay * 1000);
        setSecondsLeft(delay);
        setMessage(
          `Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau ${delay} giây.`
        );
      } else {
        setMessage("Hiện chưa thể gửi email. Vui lòng thử lại sau.");
      }
    } catch {
      setMessage("Hiện chưa thể gửi email. Vui lòng thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="verify-title">
      <p className="aihub-eyebrow">AIHub Console</p>
      <h1 className="aihub-title" id="verify-title">
        {phase === "success" ? "Email đã được xác minh" : "Xác minh email"}
      </h1>
      {phase === "loading" ? (
        <p className="aihub-lede" role="status">
          Đang xác minh email…
        </p>
      ) : phase === "success" ? (
        <>
          <p className="aihub-lede">Bạn có thể đăng nhập để tiếp tục.</p>
          <p className="auth-secondary">
            <a href="/login">Đăng nhập</a>
          </p>
        </>
      ) : (
        <>
          {message && (
            <p className="auth-error" role="alert">
              {message}
            </p>
          )}
          {phase === "retry" && token && (
            <button
              className="auth-submit"
              type="button"
              disabled={busy || secondsLeft > 0}
              onClick={() => void verify(token)}
            >
              {secondsLeft
                ? `Thử lại sau ${secondsLeft} giây`
                : "Thử xác minh lại"}
            </button>
          )}
          <form className="auth-form" onSubmit={resend}>
            <label htmlFor="recovery-email">Email</label>
            <input
              id="recovery-email"
              type="email"
              autoComplete="email"
              maxLength={320}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button
              className="auth-submit"
              type="submit"
              disabled={busy || secondsLeft > 0}
            >
              {secondsLeft
                ? `Thử lại sau ${secondsLeft} giây`
                : "Gửi hướng dẫn xác minh"}
            </button>
          </form>
          {message === RESEND_ACCEPTED && (
            <p className="auth-error" role="status">
              {message}
            </p>
          )}
          <p className="auth-secondary">
            <a href="/login">Quay lại đăng nhập</a>
          </p>
        </>
      )}
    </section>
  );
}
