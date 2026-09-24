import {
  organizationCreationKey,
  originIsAllowed,
  requireWebSession,
  webSessionIdFromRequest,
} from "@/lib/auth-session";

export async function POST(request: Request) {
  if (!originIsAllowed(request)) return new Response(null, { status: 403 });
  const denied = await requireWebSession(request);
  if (denied) return denied;
  try {
    const key = await organizationCreationKey(
      webSessionIdFromRequest(request)!
    );
    return Response.json(
      { idempotencyKey: key },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { error: { code: "SERVICE_UNAVAILABLE" } },
      { status: 503 }
    );
  }
}
