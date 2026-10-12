import { getLoginErrorMessage } from "@/lib/auth-messages";

export function LoginForm({
  next,
  returnTo = "/login",
  error,
  retry = 60,
  unavailableMessage,
  submitLabel = "Đăng nhập",
  variant,
}: {
  next: string;
  returnTo?: string;
  error?: string;
  retry?: number;
  unavailableMessage?: string;
  submitLabel?: string;
  variant?: "lab";
}) {
  const message = unavailableMessage ?? getLoginErrorMessage(error, retry);

  return (
    <form
      action="/api/auth/login"
      method="post"
      className={`auth-form${variant === "lab" ? " auth-form--lab" : ""}`}
    >
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="return_to" value={returnTo} />
      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        name="email"
        type="email"
        autoComplete="username"
        maxLength={320}
        required
      />
      <label htmlFor="login-password">Mật khẩu</label>
      <input
        id="login-password"
        name="password"
        type="password"
        autoComplete="current-password"
        maxLength={256}
        required
      />
      <p className="auth-secondary">
        <a href="/forgot-password">Quên mật khẩu?</a>
      </p>
      {message && (
        <p className="auth-error" role="alert">
          {message}
        </p>
      )}
      <button className="auth-submit" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
