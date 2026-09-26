import {
  AUTH_NO_STORE,
  postAihubAuth,
  readAihubAuthError,
} from "@/lib/auth-bff";
import {
  createWebSessionFromAihubResponse,
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

export async function POST(request: Request) {
  if (!originIsAllowed(request))
    return new Response(null, { status: 403, headers: AUTH_NO_STORE });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json(
      { error: { code: "AUTH_VERIFICATION_TOKEN_INVALID" } },
      { status: 400, headers: AUTH_NO_STORE }
    );
  }

  const token = (input as { token?: unknown } | null)?.token;
  if (typeof token !== "string" || token.length < 1 || token.length > 512)
    return Response.json(
      { error: { code: "AUTH_VERIFICATION_TOKEN_INVALID" } },
      { status: 400, headers: AUTH_NO_STORE }
    );

  const browserBinding = signupBindingFromRequest(request);
  const upstream = await postAihubAuth("/v1/auth/verify-email", {
    token,
    ...(browserBinding ? { browser_binding: browserBinding } : {}),
  });
  if (!upstream) return unavailable();

  if (upstream.status === 204) {
    const sessionId = webSessionIdFromRequest(request);
    let hasSession = false;
    if (isWebSessionId(sessionId)) {
      try {
        hasSession = !!(await getWebSession(sessionId));
      } catch {
        return unavailable();
      }
    }
    return new Response(null, {
      status: 303,
      headers: {
        ...AUTH_NO_STORE,
        Location: new URL(
          hasSession ? "/console" : "/login?verified=1",
          customerWebOrigin()
        ).toString(),
      },
    });
  }

  if (upstream.status === 200) {
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

    let newSession: Awaited<
      ReturnType<typeof createWebSessionFromAihubResponse>
    >;
    try {
      newSession = await createWebSessionFromAihubResponse(upstream);
    } catch {
      return unavailable();
    }

    if (isWebSessionId(oldSessionId)) {
      try {
        await deleteWebSession(oldSessionId);
      } catch {
        try {
          await deleteWebSession(newSession.sessionId);
        } catch {
          console.error("[auth] Could not delete uncommitted Web Session");
        }
        await logoutFromAihubBestEffort(newSession.refreshToken);
        return unavailable();
      }
    }
    if (oldRefreshToken) await logoutFromAihubBestEffort(oldRefreshToken);

    const headers = new Headers(AUTH_NO_STORE);
    headers.set(
      "Location",
      new URL("/console", customerWebOrigin()).toString()
    );
    headers.append(
      "Set-Cookie",
      webSessionCookie(newSession.sessionId, WEB_SESSION_TTL_SECONDS)
    );
    headers.append("Set-Cookie", signupBindingCookie("", 0));
    return new Response(null, { status: 303, headers });
  }

  const upstreamError = await readAihubAuthError(upstream);
  if (
    upstream.status === 400 &&
    upstreamError.code === "AUTH_VERIFICATION_TOKEN_INVALID"
  )
    return Response.json(
      { error: { code: upstreamError.code } },
      { status: 400, headers: AUTH_NO_STORE }
    );

  if (upstream.status === 429 && upstreamError.code === "RATE_LIMITED")
    return Response.json(
      {
        error: {
          code: upstreamError.code,
          retry_after_seconds: upstreamError.retryAfterSeconds,
        },
      },
      { status: 429, headers: AUTH_NO_STORE }
    );

  return Response.json(
    { error: { code: "UNAVAILABLE" } },
    { status: 503, headers: AUTH_NO_STORE }
  );
}
