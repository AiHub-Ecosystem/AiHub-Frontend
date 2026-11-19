"use client";

import { useRef, type FormEvent } from "react";
import { getLoginErrorMessage } from "@/lib/auth-messages";
import {
  getPublicProofKey,
  rememberProofKeyScope,
} from "@/lib/web-session-proof-key";

export function LoginForm({
  next,
  returnTo = "/app/login",
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
  const proofKeyField = useRef<HTMLInputElement>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    event.preventDefault();
    const email = String(new FormData(form).get("email") ?? "")
      .trim()
      .toLowerCase();
    try {
      rememberProofKeyScope(email);
      const proofKey = await getPublicProofKey(email);
      if (proofKeyField.current)
        proofKeyField.current.value = JSON.stringify(proofKey);
    } catch {
      // Key creation is best effort: signing in must still work unbound.
    }
    form.submit();
  };

  return (
    <form
      action="/app/api/auth/login"
      method="post"
      onSubmit={onSubmit}
      className={`auth-form${variant === "lab" ? " auth-form--lab" : ""}`}
    >
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="return_to" value={returnTo} />
      <input
        ref={proofKeyField}
        type="hidden"
        name="client_proof_key"
        value=""
      />
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
        <a href="/app/forgot-password">Quên mật khẩu?</a>
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
