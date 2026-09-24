import {
  AUTH_NO_STORE,
  postAihubAuth,
  readAihubAuthError,
} from "@/lib/auth-bff";
import { originIsAllowed } from "@/lib/auth-session";

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

  const body = input as Record<string, unknown> | null;
  const { email, username, password } = body ?? {};
  const fields = [
    typeof email !== "string" || email.length < 1 || email.length > 320
      ? "email"
      : null,
    typeof username !== "string" || username.length < 1 || username.length > 64
      ? "username"
      : null,
    typeof password !== "string" || password.length < 1 || password.length > 256
      ? "password"
      : null,
  ].filter((field): field is string => field !== null);
  if (fields.length > 0) {
    return Response.json(
      { error: { code: "INVALID_REQUEST", fields } },
      { status: 400, headers: AUTH_NO_STORE }
    );
  }

  const upstream = await postAihubAuth("/v1/auth/register", {
    email,
    username,
    password,
  });
  if (!upstream)
    return Response.json(
      { error: { code: "UNAVAILABLE" } },
      { status: 503, headers: AUTH_NO_STORE }
    );

  if (upstream.status === 201) {
    let responseBody: { data?: { status?: unknown } };
    try {
      responseBody = await upstream.json();
    } catch {
      responseBody = {};
    }
    if (responseBody.data?.status === "pending_verification")
      return Response.json(
        { status: "pending_verification" },
        { status: 201, headers: AUTH_NO_STORE }
      );
  }

  const upstreamError = await readAihubAuthError(upstream);
  if (
    upstream.status === 409 &&
    upstreamError.code === "AUTH_IDENTITY_UNAVAILABLE"
  )
    return Response.json(
      { error: { code: upstreamError.code } },
      { status: 409, headers: AUTH_NO_STORE }
    );

  if (upstream.status === 400 && upstreamError.code === "INVALID_REQUEST")
    return Response.json(
      { error: { code: upstreamError.code } },
      { status: 400, headers: AUTH_NO_STORE }
    );

  if (upstream.status === 429 && upstreamError.code === "RATE_LIMITED") {
    return Response.json(
      {
        error: {
          code: upstreamError.code,
          retry_after_seconds: upstreamError.retryAfterSeconds,
        },
      },
      { status: 429, headers: AUTH_NO_STORE }
    );
  }

  if (
    upstream.status === 503 &&
    upstreamError.code === "AUTH_EMAIL_DELIVERY_UNAVAILABLE"
  )
    return Response.json(
      { error: { code: upstreamError.code } },
      { status: 503, headers: AUTH_NO_STORE }
    );

  return Response.json(
    { error: { code: "UNAVAILABLE" } },
    { status: 503, headers: AUTH_NO_STORE }
  );
}
