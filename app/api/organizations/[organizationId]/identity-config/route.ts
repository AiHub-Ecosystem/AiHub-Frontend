import {
  authenticatedAihubFetch,
  originIsAllowed,
  requireWebSession,
  webSessionIdFromRequest,
} from "@/lib/auth-session";
import {
  forwardIdentityResponse,
  identityNoStore,
  readIdentityInput,
} from "@/lib/organization-identity-bff";

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const denied = await requireWebSession(request);
  if (denied) return denied;
  const { organizationId } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(organizationId))
    return new Response(null, { status: 404, headers: identityNoStore });
  try {
    const upstream = await authenticatedAihubFetch(
      request,
      webSessionIdFromRequest(request)!,
      `/v1/organizations/${encodeURIComponent(organizationId)}/identity-config`
    );
    return forwardIdentityResponse(upstream);
  } catch {
    return Response.json(
      { error: { code: "IDENTITY_CONFIG_REQUEST_FAILED" } },
      { status: 503, headers: identityNoStore }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  if (!originIsAllowed(request))
    return new Response(null, { status: 403, headers: identityNoStore });
  const denied = await requireWebSession(request);
  if (denied) return denied;
  const { organizationId } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(organizationId))
    return new Response(null, { status: 404, headers: identityNoStore });
  const result = await readIdentityInput(request);
  if (!result.input)
    return Response.json(
      { error: { code: result.error } },
      { status: 400, headers: identityNoStore }
    );
  try {
    const upstream = await authenticatedAihubFetch(
      request,
      webSessionIdFromRequest(request)!,
      `/v1/organizations/${encodeURIComponent(organizationId)}/identity-config`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.input),
      }
    );
    return forwardIdentityResponse(upstream);
  } catch {
    return Response.json(
      { error: { code: "IDENTITY_CONFIG_REQUEST_FAILED" } },
      { status: 503, headers: identityNoStore }
    );
  }
}
