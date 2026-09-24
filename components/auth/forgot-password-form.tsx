"use client";

import { useEffect, useState, type FormEvent } from "react";

type AuthError = {
  code?: unknown;
  fields?: unknown;
  retry_after_seconds?: unknown;
};

const ACCEPTED =
  "Nếu địa chỉ email này có User Account, chúng tôi sẽ gửi hướng dẫn phù hợp.";

function boundedRetry(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(3600, Math.max(1, Math.ceil(value)))
    : 60;
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [accepted, setAccepted] = useState(false);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setFieldError("");
    setAccepted(false);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json().catch(() => ({}));
      const error = (body as { error?: AuthError }).error;
      if (response.status === 202) {
        setAccepted(true);
        setMessage(ACCEPTED);
        return;
      }
      if (error?.code === "INVALID_REQUEST") {
        const fields = Array.isArray(error.fields) ? error.fields : [];
        if (fields.includes("email")) setFieldError("Email không hợp lệ.");
        setMessage("Vui lòng kiểm tra lại địa chỉ email.");
      } else if (error?.code === "RATE_LIMITED") {
        const delay = boundedRetry(error.retry_after_seconds);
        setRetryUntil(Date.now() + delay * 1000);
        setSecondsLeft(delay);
        setMessage(
          `Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau ${delay} giây.`
        );
      } else {
        setMessage("Hiện chưa thể gửi hướng dẫn. Vui lòng thử lại sau.");
      }
    } catch {
      setMessage("Hiện chưa thể gửi hướng dẫn. Vui lòng thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || secondsLeft > 0;

  return (
    <section className="auth-card" aria-labelledby="forgot-password-title">
      <p className="aihub-eyebrow">AIHub Console</p>
      <h1 className="aihub-title" id="forgot-password-title">
        {accepted ? "Kiểm tra email" : "Quên mật khẩu"}
      </h1>
      {accepted ? (
        <>
          <p className="aihub-lede">{message || ACCEPTED}</p>
          <p className="auth-address">{email}</p>
        </>
      ) : (
        <>
          <p className="aihub-lede">
            Nhập email để nhận hướng dẫn đặt lại mật khẩu nếu địa chỉ này có
            User Account.
          </p>
          <form className="auth-form" onSubmit={submit}>
            <label htmlFor="forgot-password-email">Email</label>
            <input
              id="forgot-password-email"
              type="email"
              autoComplete="email"
              maxLength={320}
              required
              value={email}
              aria-invalid={!!fieldError}
              aria-describedby={
                fieldError ? "forgot-password-email-error" : undefined
              }
              onChange={(event) => setEmail(event.target.value)}
            />
            {fieldError && (
              <p className="auth-error" id="forgot-password-email-error">
                {fieldError}
              </p>
            )}
            {message && (
              <p className="auth-error" role="alert">
                {message}
              </p>
            )}
            <button className="auth-submit" type="submit" disabled={disabled}>
              {secondsLeft
                ? `Thử lại sau ${secondsLeft} giây`
                : "Gửi hướng dẫn"}
            </button>
          </form>
        </>
      )}
      <p className="auth-secondary">
        <a href="/login">Quay lại đăng nhập</a>
      </p>
    </section>
  );
}
