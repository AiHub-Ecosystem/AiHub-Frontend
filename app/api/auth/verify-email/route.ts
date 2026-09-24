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

  const upstream = await postAihubAuth("/v1/auth/verify-email", { token });
  if (!upstream)
    return Response.json(
      { error: { code: "UNAVAILABLE" } },
      { status: 503, headers: AUTH_NO_STORE }
    );

  if (upstream.status === 204)
    return new Response(null, { status: 204, headers: AUTH_NO_STORE });

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
