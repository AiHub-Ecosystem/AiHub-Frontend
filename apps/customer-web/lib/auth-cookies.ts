import { randomBytes } from "node:crypto";

// `__Host-` requires Path=/, so a cookie scoped to the /app basePath uses `__Secure-`.
export const WEB_SESSION_COOKIE = "__Secure-aihub_web_session";
export const LEGACY_WEB_SESSION_COOKIE = "__Host-aihub_web_session";
export const SIGNUP_BINDING_COOKIE = "__Host-aihub_signup";
export const SIGNUP_BINDING_TTL_SECONDS = 24 * 60 * 60;

export function webSessionCookie(value: string, maxAge: number) {
  return `${WEB_SESSION_COOKIE}=${value}; Path=/app; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export function expiredLegacyWebSessionCookie() {
  return `${LEGACY_WEB_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function expiredWebSessionCookies() {
  return [webSessionCookie("", 0), expiredLegacyWebSessionCookie()];
}

export function appendExpiredWebSessionCookies(headers: Headers) {
  for (const cookie of expiredWebSessionCookies())
    headers.append("Set-Cookie", cookie);
  return headers;
}

export function webSessionClearHeaders(headers: HeadersInit, clear: boolean) {
  const result = new Headers(headers);
  return clear ? appendExpiredWebSessionCookies(result) : result;
}

export function newSignupBinding() {
  return randomBytes(32).toString("base64url");
}

export function signupBindingFromRequest(request: Request) {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SIGNUP_BINDING_COOKIE}=`))
    ?.slice(SIGNUP_BINDING_COOKIE.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function signupBindingCookie(
  value: string,
  maxAge = SIGNUP_BINDING_TTL_SECONDS
) {
  return `${SIGNUP_BINDING_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export function isWebSessionId(value: string | undefined): value is string {
  return !!value && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function webSessionIdFromRequest(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${WEB_SESSION_COOKIE}=`))
    ?.slice(WEB_SESSION_COOKIE.length + 1);
}
