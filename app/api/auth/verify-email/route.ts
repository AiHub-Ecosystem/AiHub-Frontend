import {
  AUTH_NO_STORE,
  postAihubAuth,
  readAihubAuthError,
} from "@/lib/auth-bff";
import { createWebSessionFromAihubResponse } from "@/lib/auth-session-from-response";
import {
  customerWebOrigin,
  deleteWebSession,
  extractRefreshToken,
  getWebSession,
  isWebSessionId,
  logoutFromAihubBestEffort,
  originIsAllowed,
  signupBindingCookie,
  signupBindingFromRequest,
  webSessionCookie,
  webSessionIdFromRequest,
  WEB_SESSION_TTL_SECONDS,
} from "@/lib/auth-session";

function unavailable() {
  return Response.json(
    { error: { code: "UNAVAILABLE" } },
    { status: 503, headers: AUTH_NO_STORE }
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

async function verifyOnly(request: Request) {
  const sessionId = webSessionIdFromRequest(request);
  let hasSession = false;
  if (isWebSessionId(sessionId)) {
    try {
      hasSession = !!(await getWebSession(sessionId));
    } catch {
      return unavailable();
    }
  }
  const location = hasSession ? "/console" : "/login?verified=1";
  return new Response(null, {
    status: 303,
    headers: {
      ...AUTH_NO_STORE,
      Location: new URL(location, customerWebOrigin()).toString(),
    },
  });
}

async function discardNewSession(sessionId: string, refreshToken: string) {
  try {
    await deleteWebSession(sessionId);
  } catch {
    console.error("[auth] Could not delete uncommitted Web Session");
  }
  await logoutFromAihubBestEffort(refreshToken);
}

async function verificationSignIn(request: Request, upstream: Response) {
  const oldSessionId = webSessionIdFromRequest(request);
  let oldRefreshToken: string | undefined;
  if (isWebSessionId(oldSessionId)) {
    try {
      oldRefreshToken = (await getWebSession(oldSessionId))?.refreshToken;
    } catch {
      const refreshToken = extractRefreshToken(upstream.headers);
      if (refreshToken) await logoutFromAihubBestEffort(refreshToken);
      return unavailable();
    }
  }

  let newSession: Awaited<ReturnType<typeof createWebSessionFromAihubResponse>>;
  try {
    newSession = await createWebSessionFromAihubResponse(upstream);
  } catch {
    return unavailable();
  }

  if (isWebSessionId(oldSessionId)) {
    try {
      await deleteWebSession(oldSessionId);
    } catch {
      await discardNewSession(newSession.sessionId, newSession.refreshToken);
      return unavailable();
    }
  }
  if (oldRefreshToken) await logoutFromAihubBestEffort(oldRefreshToken);

  const headers = new Headers(AUTH_NO_STORE);
  headers.set("Location", new URL("/console", customerWebOrigin()).toString());
  headers.append(
    "Set-Cookie",
    webSessionCookie(newSession.sessionId, WEB_SESSION_TTL_SECONDS)
  );
  headers.append("Set-Cookie", signupBindingCookie("", 0));
  return new Response(null, { status: 303, headers });
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
  const upstream = await postAihubAuth("/v1/auth/verify-email", {
    token,
    ...(browserBinding ? { browser_binding: browserBinding } : {}),
  });
  if (!upstream) return unavailable();
  if (upstream.status === 204) return verifyOnly(request);
  if (upstream.status === 200) return verificationSignIn(request, upstream);
  return verificationFailure(upstream);
}
