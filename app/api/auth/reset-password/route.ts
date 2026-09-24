import {
  AUTH_NO_STORE,
  postAihubAuth,
  readAihubAuthError,
} from "@/lib/auth-bff";
import {
  deleteWebSession,
  isWebSessionId,
  originIsAllowed,
  webSessionIdFromRequest,
  webSessionCookie,
} from "@/lib/auth-session";

export async function POST(request: Request) {
  if (!originIsAllowed(request))
    return new Response(null, { status: 403, headers: AUTH_NO_STORE });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json(
      { error: { code: "INVALID_REQUEST" } },
      { status: 400, headers: AUTH_NO_STORE }
    );
  }

  const body = input as { token?: unknown; password?: unknown } | null;
  const fields = [
    typeof body?.token !== "string" ||
    body.token.length < 1 ||
    body.token.length > 512
      ? "token"
      : null,
    typeof body?.password !== "string" ||
    [...body.password].length < 12 ||
    [...body.password].length > 128
      ? "password"
      : null,
  ].filter((field): field is string => field !== null);
  if (fields.length > 0)
    return Response.json(
      { error: { code: "INVALID_REQUEST", fields } },
      { status: 400, headers: AUTH_NO_STORE }
    );

  const upstream = await postAihubAuth("/v1/auth/reset-password", {
    token: body!.token,
    password: body!.password,
  });
  if (!upstream)
    return Response.json(
      { error: { code: "UNAVAILABLE" } },
      { status: 503, headers: AUTH_NO_STORE }
    );

  if (upstream.status === 204) {
    const sessionId = webSessionIdFromRequest(request);
    if (isWebSessionId(sessionId)) {
      try {
        await deleteWebSession(sessionId);
      } catch {
        console.warn(
          "[auth] Could not delete Web Session during password reset"
        );
      }
    }
    return new Response(null, {
      status: 204,
      headers: {
        ...AUTH_NO_STORE,
        "Set-Cookie": webSessionCookie("", 0),
      },
    });
  }

  const upstreamError = await readAihubAuthError(upstream);
  if (
    upstream.status === 400 &&
    upstreamError.code === "AUTH_PASSWORD_RESET_TOKEN_INVALID"
  )
    return Response.json(
      { error: { code: upstreamError.code } },
      { status: 400, headers: AUTH_NO_STORE }
    );

  if (upstream.status === 400 && upstreamError.code === "INVALID_REQUEST")
    return Response.json(
      { error: { code: "INVALID_REQUEST" } },
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
