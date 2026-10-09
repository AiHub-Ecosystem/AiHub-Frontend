import {
  authenticatedAihubFetch,
  rejectedWebSessionCookie,
  requireWebSession,
  webSessionIdFromRequest,
} from "@/lib/auth-session";

export async function GET(request: Request) {
  const denied = await requireWebSession(request);
  if (denied) return denied;
  const sessionId = webSessionIdFromRequest(request)!;
  try {
    const upstream = await authenticatedAihubFetch(
      sessionId,
      "/v1/organizations/me/members"
    );
    if (!upstream.ok) {
      const clearCookie = rejectedWebSessionCookie(upstream);
      return Response.json(
        {
          success: false,
          error: {
            code: clearCookie
              ? "AUTH_REQUIRED"
              : "ORGANIZATION_ROSTER_UNAVAILABLE",
          },
        },
        {
          status: clearCookie ? 401 : 503,
          headers: {
            "Cache-Control": "no-store",
            ...(clearCookie ? { "Set-Cookie": clearCookie } : {}),
          },
        }
      );
    }
    return new Response(await upstream.text(), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    });
  } catch {
    return Response.json(
      { success: false, error: { code: "ORGANIZATION_ROSTER_UNAVAILABLE" } },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
