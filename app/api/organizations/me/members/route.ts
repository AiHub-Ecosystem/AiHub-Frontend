import {
  authenticatedAihubFetch,
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
      return Response.json(
        { success: false, error: { code: "ORGANIZATION_ROSTER_UNAVAILABLE" } },
        {
          status: upstream.status === 401 ? 401 : 503,
          headers: { "Cache-Control": "no-store" },
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
