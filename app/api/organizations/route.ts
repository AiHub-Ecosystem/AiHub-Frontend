import {
  authenticatedAihubFetch,
  originIsAllowed,
  rejectedWebSessionCookie,
  requireWebSession,
  webSessionIdFromRequest,
} from "@/lib/auth-session";
import {
  validatedOrganizationName,
  UUID_V4_PATTERN,
} from "@/lib/organizations";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!originIsAllowed(request))
    return new Response(null, { status: 403, headers: noStore });
  const denied = await requireWebSession(request);
  if (denied) return denied;
  const sessionId = webSessionIdFromRequest(request)!;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: "INVALID_NAME" } },
      { status: 400, headers: noStore }
    );
  }
  const name = validatedOrganizationName(
    (body as { name?: unknown } | null)?.name
  );
  if (!name) {
    return Response.json(
      { error: { code: "INVALID_NAME" } },
      { status: 400, headers: noStore }
    );
  }
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || !UUID_V4_PATTERN.test(idempotencyKey)) {
    return Response.json(
      { error: { code: "IDEMPOTENCY_KEY_REQUIRED" } },
      { status: 400, headers: noStore }
    );
  }
  try {
    const upstream = await authenticatedAihubFetch(
      request,
      sessionId,
      "/v1/organizations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ name }),
      }
    );
    const responseText = await upstream.text();
    if (upstream.ok) {
      // The client acknowledges success after receiving it; lost responses keep the same key for safe replay.
      return new Response(responseText, {
        status: upstream.status,
        headers: { ...noStore, "Content-Type": "application/json" },
      });
    }
    let code = "ORGANIZATION_CREATE_FAILED";
    try {
      const parsed = JSON.parse(responseText) as { error?: { code?: unknown } };
      if (typeof parsed.error?.code === "string") code = parsed.error.code;
    } catch {}
    const clearCookie = rejectedWebSessionCookie(upstream);
    return Response.json(
      { error: { code } },
      {
        status: upstream.status,
        headers: {
          ...noStore,
          ...(clearCookie ? { "Set-Cookie": clearCookie } : {}),
        },
      }
    );
  } catch {
    return Response.json(
      { error: { code: "ORGANIZATION_CREATE_UNAVAILABLE" } },
      { status: 503, headers: noStore }
    );
  }
}
