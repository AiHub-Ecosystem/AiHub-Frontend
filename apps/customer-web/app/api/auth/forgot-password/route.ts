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

  const email = (input as { email?: unknown } | null)?.email;
  if (typeof email !== "string" || email.length < 1 || email.length > 320)
    return Response.json(
      { error: { code: "INVALID_REQUEST", fields: ["email"] } },
      { status: 400, headers: AUTH_NO_STORE }
    );

  const upstream = await postAihubAuth("/v1/auth/forgot-password", { email });
  if (!upstream)
    return Response.json(
      { error: { code: "UNAVAILABLE" } },
      { status: 503, headers: AUTH_NO_STORE }
    );

  if (upstream.status === 202)
    return Response.json(
      { status: "accepted" },
      { status: 202, headers: AUTH_NO_STORE }
    );

  const upstreamError = await readAihubAuthError(upstream);
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

  if (upstream.status === 400 && upstreamError.code === "INVALID_REQUEST")
    return Response.json(
      { error: { code: "INVALID_REQUEST" } },
      { status: 400, headers: AUTH_NO_STORE }
    );

  return Response.json(
    { error: { code: "UNAVAILABLE" } },
    { status: 503, headers: AUTH_NO_STORE }
  );
}
