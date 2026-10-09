import {
  authenticatedAihubFetch,
  originIsAllowed,
  rejectedWebSessionCookie,
  requireWebSession,
  webSessionIdFromRequest,
} from "@/lib/auth-session";
import { validatedOrganizationName } from "@/lib/organizations";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  if (!originIsAllowed(request)) return new Response(null, { status: 403 });
  const denied = await requireWebSession(request);
  if (denied) return denied;
  const { organizationId } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(organizationId))
    return new Response(null, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_NAME" } }, { status: 400 });
  }
  const name = validatedOrganizationName(
    (body as { name?: unknown } | null)?.name
  );
  if (!name) {
    return Response.json({ error: { code: "INVALID_NAME" } }, { status: 400 });
  }
  try {
    const upstream = await authenticatedAihubFetch(
      webSessionIdFromRequest(request)!,
      `/v1/organizations/${encodeURIComponent(organizationId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }
    );
    if (upstream.status === 403 || upstream.status === 404)
      return new Response(null, { status: 404 });
    const clearCookie = rejectedWebSessionCookie(upstream);
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
        ...(clearCookie ? { "Set-Cookie": clearCookie } : {}),
      },
    });
  } catch {
    return Response.json(
      { error: { code: "ORGANIZATION_RENAME_UNAVAILABLE" } },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
