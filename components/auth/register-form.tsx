"use client";

import { useEffect, useState, type FormEvent } from "react";

type AuthError = {
  code?: unknown;
  fields?: unknown;
  retry_after_seconds?: unknown;
};

const RESEND_ACCEPTED =
  "Nếu địa chỉ email này có User Account, chúng tôi sẽ gửi hướng dẫn phù hợp.";

function boundedRetry(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(3600, Math.max(1, Math.ceil(value)))
    : 60;
}

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<"form" | "confirmation">("form");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [canResend, setCanResend] = useState(false);
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

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setFieldErrors({});
    setCanResend(false);
    let body: { error?: AuthError } = {};
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });
      if (response.status === 201) {
        setPhase("confirmation");
        setPassword("");
        setMessage(
          "Tài khoản đang chờ xác minh. Hãy kiểm tra email để tiếp tục."
        );
        return;
      }
      body = await response.json().catch(() => ({}));
      const error = body.error;
      if (error?.code === "AUTH_EMAIL_DELIVERY_UNAVAILABLE") {
        setPhase("confirmation");
        setPassword("");
        setMessage("Chưa gửi được email xác minh. Bạn có thể thử gửi lại.");
      } else if (error?.code === "AUTH_IDENTITY_UNAVAILABLE") {
        setMessage("Email hoặc username đã được dùng.");
      } else if (error?.code === "INVALID_REQUEST") {
        const fields = Array.isArray(error.fields) ? error.fields : [];
        const errors: Record<string, string> = {};
        if (fields.includes("email")) errors.email = "Email không hợp lệ.";
        if (fields.includes("username"))
          errors.username = "Username không hợp lệ.";
        if (fields.includes("password"))
          errors.password = "Mật khẩu không hợp lệ.";
        setFieldErrors(errors);
        setMessage(
          Object.keys(errors).length
            ? "Vui lòng kiểm tra lại thông tin đăng ký."
            : "Thông tin đăng ký chưa hợp lệ. Vui lòng kiểm tra lại."
        );
      } else if (error?.code === "RATE_LIMITED") {
        const delay = boundedRetry(error.retry_after_seconds);
        setRetryUntil(Date.now() + delay * 1000);
        setSecondsLeft(delay);
        setMessage(
          `Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau ${delay} giây.`
        );
      } else {
        setMessage("Hiện chưa thể đăng ký. Vui lòng thử lại sau.");
        setCanResend(true);
      }
      setPassword("");
    } catch {
      setMessage("Hiện chưa thể đăng ký. Vui lòng thử lại sau.");
      setCanResend(true);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  async function resend(address: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
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

  const disabled = busy || secondsLeft > 0;

  return (
    <section className="auth-card" aria-labelledby="register-title">
      <p className="aihub-eyebrow">AIHub Console</p>
      <h1 className="aihub-title" id="register-title">
        {phase === "confirmation" ? "Kiểm tra email" : "Đăng ký"}
      </h1>
      {phase === "confirmation" ? (
        <>
          <p className="aihub-lede">
            {message || "Hãy kiểm tra hộp thư đến để xác minh địa chỉ email."}
          </p>
          <p className="auth-address">{email}</p>
          <button
            className="auth-submit"
            type="button"
            disabled={disabled}
            onClick={() => void resend(email)}
          >
            {secondsLeft ? `Thử lại sau ${secondsLeft} giây` : "Gửi lại email"}
          </button>
          {message === RESEND_ACCEPTED && (
            <p className="auth-error" role="alert">
              {message}
            </p>
          )}
          <p className="auth-secondary">
            <a href="/login">Quay lại đăng nhập</a>
          </p>
        </>
      ) : (
        <>
          <p className="aihub-lede">
            Tạo User Account để sử dụng AIHub Console.
          </p>
          <form className="auth-form" onSubmit={register}>
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              maxLength={320}
              required
              value={email}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={
                fieldErrors.email ? "register-email-error" : undefined
              }
              onChange={(event) => setEmail(event.target.value)}
            />
            {fieldErrors.email && (
              <p className="auth-error" id="register-email-error">
                {fieldErrors.email}
              </p>
            )}
            <label htmlFor="register-username">Username</label>
            <input
              id="register-username"
              autoComplete="username"
              maxLength={64}
              required
              value={username}
              aria-invalid={!!fieldErrors.username}
              aria-describedby={
                fieldErrors.username ? "register-username-error" : undefined
              }
              onChange={(event) => setUsername(event.target.value)}
            />
            {fieldErrors.username && (
              <p className="auth-error" id="register-username-error">
                {fieldErrors.username}
              </p>
            )}
            <label htmlFor="register-password">Mật khẩu</label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              maxLength={256}
              required
              value={password}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={
                fieldErrors.password ? "register-password-error" : undefined
              }
              onChange={(event) => setPassword(event.target.value)}
            />
            {fieldErrors.password && (
              <p className="auth-error" id="register-password-error">
                {fieldErrors.password}
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
                : "Tạo tài khoản"}
            </button>
          </form>
          {canResend && email && (
            <button
              className="auth-link-button"
              type="button"
              disabled={disabled}
              onClick={() => void resend(email)}
            >
              Gửi lại email xác minh
            </button>
          )}
          <p className="auth-secondary">
            Đã có tài khoản? <a href="/login">Đăng nhập</a>
          </p>
        </>
      )}
    </section>
  );
}
