"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  boundedRetry,
  type AuthError,
} from "@/components/auth/auth-form-utils";

function passwordLength(value: string) {
  return [...value].length;
}

export function ResetPasswordForm() {
  const started = useRef(false);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phase, setPhase] = useState<
    "loading" | "form" | "success" | "expired"
  >("loading");
  const [message, setMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
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

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const current = new URL(window.location.href);
    const value = current.searchParams.get("token") ?? "";
    window.history.replaceState(window.history.state, "", current.pathname);
    if (!value) {
      // The recovery state depends on the browser URL, available after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("expired");
      setMessage(
        "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới."
      );
      return;
    }
    // The token is read after hydration, scrubbed from history, then kept in memory.
    setToken(value);
    setPhase("form");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setPasswordError("");
    const length = passwordLength(password);
    if (length < 12 || length > 128) {
      setPasswordError("Mật khẩu phải có từ 12 đến 128 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Mật khẩu không khớp.");
      return;
    }
    if (!token || secondsLeft > 0) return;

    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (response.status === 204) {
        setToken("");
        setPassword("");
        setConfirmPassword("");
        setPhase("success");
        return;
      }
      const body = await response.json().catch(() => ({}));
      const error = (body as { error?: AuthError }).error;
      if (error?.code === "AUTH_PASSWORD_RESET_TOKEN_INVALID") {
        setToken("");
        setPassword("");
        setConfirmPassword("");
        setPhase("expired");
        setMessage(
          "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới."
        );
      } else if (error?.code === "INVALID_REQUEST") {
        setPasswordError("Mật khẩu không hợp lệ.");
      } else if (error?.code === "RATE_LIMITED") {
        const delay = boundedRetry(error.retry_after_seconds);
        setRetryUntil(Date.now() + delay * 1000);
        setSecondsLeft(delay);
        setMessage(
          `Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ${delay} giây.`
        );
      } else {
        setMessage("Hiện chưa thể đặt lại mật khẩu. Vui lòng thử lại sau.");
      }
      setPassword("");
      setConfirmPassword("");
    } catch {
      setMessage("Hiện chưa thể đặt lại mật khẩu. Vui lòng thử lại sau.");
      setPassword("");
      setConfirmPassword("");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || secondsLeft > 0;

  return (
    <section className="auth-card" aria-labelledby="reset-password-title">
      <p className="aihub-eyebrow">AIHub Console</p>
      <h1 className="aihub-title" id="reset-password-title">
        {phase === "success" ? "Đổi mật khẩu thành công" : "Đặt mật khẩu mới"}
      </h1>
      {phase === "loading" ? (
        <p className="aihub-lede" role="status">
          Đang kiểm tra liên kết…
        </p>
      ) : phase === "success" ? (
        <>
          <p className="aihub-lede">Bạn có thể đăng nhập bằng mật khẩu mới.</p>
          <p className="auth-secondary">
            <a href="/login">Đăng nhập</a>
          </p>
        </>
      ) : phase === "expired" ? (
        <>
          <p className="auth-error" role="alert">
            {message}
          </p>
          <p className="auth-secondary">
            <a href="/forgot-password">Yêu cầu liên kết mới</a>
          </p>
        </>
      ) : (
        <>
          <p className="aihub-lede">
            Mật khẩu mới phải có từ 12 đến 128 ký tự.
          </p>
          <form className="auth-form" onSubmit={submit}>
            <label htmlFor="reset-password">Mật khẩu mới</label>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              maxLength={256}
              required
              value={password}
              aria-invalid={!!passwordError}
              aria-describedby={
                passwordError ? "reset-password-error" : undefined
              }
              onChange={(event) => setPassword(event.target.value)}
            />
            <label htmlFor="reset-password-confirm">Xác nhận mật khẩu</label>
            <input
              id="reset-password-confirm"
              type="password"
              autoComplete="new-password"
              maxLength={256}
              required
              value={confirmPassword}
              aria-invalid={!!passwordError}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {passwordError && (
              <p className="auth-error" id="reset-password-error" role="alert">
                {passwordError}
              </p>
            )}
            {message && (
              <p className="auth-error" role="alert">
                {message}
              </p>
            )}
            <button className="auth-submit" type="submit" disabled={disabled}>
              {secondsLeft ? `Thử lại sau ${secondsLeft} giây` : "Đặt mật khẩu"}
            </button>
          </form>
          <p className="auth-secondary">
            <a href="/forgot-password">Yêu cầu liên kết mới</a>
          </p>
        </>
      )}
    </section>
  );
}
