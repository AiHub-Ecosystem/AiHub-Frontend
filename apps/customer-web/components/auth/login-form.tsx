"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { getLoginErrorMessage } from "@/lib/auth-messages";
import {
  currentProofKeyScope,
  getPublicProofKey,
  installProofKeyCookie,
  rememberProofKeyScope,
} from "@/lib/web-session-proof-key";

type ProofKey = Awaited<ReturnType<typeof getPublicProofKey>>;

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
  const keys = useRef(new Map<string, ProofKey>());

  // Generate ahead of submission: the form keeps its native synchronous
  // navigation, so a slow IndexedDB/crypto round never delays sign-in.
  const prepare = (scope: string) => {
    if (!scope) return;
    void getPublicProofKey(scope)
      .then((key) => {
        keys.current.set(scope, key);
        installProofKeyCookie(key);
      })
      .catch(() => {});
  };

  useEffect(() => {
    const scope = currentProofKeyScope();
    if (scope) prepare(scope);
  }, []);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const email = String(new FormData(event.currentTarget).get("email") ?? "")
      .trim()
      .toLowerCase();
    rememberProofKeyScope(email);
    const key = keys.current.get(email);
    if (key) installProofKeyCookie(key);
    else prepare(email);
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
      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        name="email"
        type="email"
        autoComplete="username"
        maxLength={320}
        onChange={(event) => prepare(event.target.value.trim().toLowerCase())}
        onBlur={(event) => prepare(event.target.value.trim().toLowerCase())}
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
