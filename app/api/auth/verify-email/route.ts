import { AUTH_NO_STORE, readAihubAuthError } from "@/lib/auth-bff";
import {
  customerWebOrigin,
  endUserIpFromHeaders,
  getCurrentWebSession,
  isWebSessionId,
  logoutFromAihubBestEffort,
  originIsAllowed,
  postAihubWebSession,
  readCreatedWebSession,
  signupBindingCookie,
  signupBindingFromRequest,
  webSessionCookie,
  webSessionIdFromRequest,
  WEB_SESSION_TTL_SECONDS,
} from "@/lib/auth-session";

function unavailable(clearSignupBinding = false) {
  const headers = new Headers(AUTH_NO_STORE);
  if (clearSignupBinding)
    headers.append("Set-Cookie", signupBindingCookie("", 0));
  return Response.json(
    { error: { code: "UNAVAILABLE" } },
    { status: 503, headers }
  );
}

function invalidToken() {
  return Response.json(
    { error: { code: "AUTH_VERIFICATION_TOKEN_INVALID" } },
    { status: 400, headers: AUTH_NO_STORE }
  );
}

async function requestToken(request: Request): Promise<string | Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return invalidToken();
  }

  const token = (input as { token?: unknown } | null)?.token;
  return typeof token === "string" && token.length >= 1 && token.length <= 512
    ? token
    : invalidToken();
}

function redirectTo(path: string, cookies: string[]) {
  const headers = new Headers(AUTH_NO_STORE);
  headers.set("Location", new URL(path, customerWebOrigin()).toString());
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

async function verifyOnly(request: Request) {
  const oldToken = webSessionIdFromRequest(request);
  const cookies = [signupBindingCookie("", 0)];
  if (isWebSessionId(oldToken)) {
    try {
      if (
        await getCurrentWebSession(
          oldToken,
          endUserIpFromHeaders(request.headers)
        )
      )
        return redirectTo("/console", cookies);
    } catch {
      return unavailable(true);
    }
    cookies.push(webSessionCookie("", 0));
  }
  return redirectTo("/login?verified=1", cookies);
}

async function verificationSignIn(request: Request, upstream: Response) {
  let newToken: string;
  try {
    newToken = await readCreatedWebSession(upstream);
  } catch {
    return unavailable();
  }

  const oldToken = webSessionIdFromRequest(request);
  if (isWebSessionId(oldToken))
    void logoutFromAihubBestEffort(
      oldToken,
      endUserIpFromHeaders(request.headers)
    );

  return redirectTo("/console", [
    webSessionCookie(newToken, WEB_SESSION_TTL_SECONDS),
    signupBindingCookie("", 0),
  ]);
}

async function verificationFailure(upstream: Response) {
  const error = await readAihubAuthError(upstream);
  if (
    upstream.status === 400 &&
    error.code === "AUTH_VERIFICATION_TOKEN_INVALID"
  )
    return Response.json(
      { error: { code: error.code } },
      { status: 400, headers: AUTH_NO_STORE }
    );

  if (upstream.status === 429 && error.code === "RATE_LIMITED")
    return Response.json(
      {
        error: {
          code: error.code,
          retry_after_seconds: error.retryAfterSeconds,
        },
      },
      { status: 429, headers: AUTH_NO_STORE }
    );

  return unavailable();
}

export async function POST(request: Request) {
  if (!originIsAllowed(request))
    return new Response(null, { status: 403, headers: AUTH_NO_STORE });

  const token = await requestToken(request);
  if (token instanceof Response) return token;

  const browserBinding = signupBindingFromRequest(request);
  let upstream: Response;
  try {
    upstream = await postAihubWebSession(
      "/v1/auth/web-sessions/verification",
      {
        token,
        ...(browserBinding ? { browser_binding: browserBinding } : {}),
      },
      endUserIpFromHeaders(request.headers)
    );
  } catch {
    return unavailable();
  }
  if (upstream.status === 204) return verifyOnly(request);
  if (upstream.status === 201) return verificationSignIn(request, upstream);
  return verificationFailure(upstream);
}
