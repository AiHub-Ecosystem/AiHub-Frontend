import {
  authenticatedAihubFetch,
  originIsAllowed,
  requireWebSession,
  webSessionIdFromRequest,
} from "@/lib/auth-session";
import {
  apiKeyNoStore,
  apiKeyRequestUnavailable,
  forwardApiKeyResponse,
  parseCreateApiKeyInput,
  readCreateApiKeyBody,
  validOrganizationId,
} from "@/lib/organization-api-keys-bff";
import {
  parseMintedOrganizationApiKey,
  parseOrganizationApiKeyList,
} from "@/lib/api-keys";

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const denied = await requireWebSession(request);
  if (denied) return denied;
  const { organizationId } = await context.params;
  if (!validOrganizationId(organizationId))
    return new Response(null, { status: 404, headers: apiKeyNoStore });

  try {
    const upstream = await authenticatedAihubFetch(
      request,
      webSessionIdFromRequest(request)!,
      `/v1/organizations/${encodeURIComponent(organizationId)}/api-keys`
    );
    return await forwardApiKeyResponse(upstream, (payload) => {
      const keys = parseOrganizationApiKeyList(payload);
      return keys ? { data: { api_keys: keys } } : null;
    });
  } catch {
    return apiKeyRequestUnavailable("API_KEY_LIST_UNAVAILABLE");
  }
}

export async function POST(request: Request, context: RouteContext) {
  if (!originIsAllowed(request))
    return new Response(null, { status: 403, headers: apiKeyNoStore });
  const denied = await requireWebSession(request);
  if (denied) return denied;
  const { organizationId } = await context.params;
  if (!validOrganizationId(organizationId))
    return new Response(null, { status: 404, headers: apiKeyNoStore });

  const body = await readCreateApiKeyBody(request);
  const input = parseCreateApiKeyInput(body);
  if (!input)
    return Response.json(
      { error: { code: "INVALID_REQUEST" } },
      { status: 400, headers: apiKeyNoStore }
    );

  try {
    const upstream = await authenticatedAihubFetch(
      request,
      webSessionIdFromRequest(request)!,
      `/v1/organizations/${encodeURIComponent(organizationId)}/api-keys`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );
    return await forwardApiKeyResponse(upstream, (payload) => {
      const apiKey = parseMintedOrganizationApiKey(payload);
      return apiKey ? { data: apiKey } : null;
    });
  } catch {
    return apiKeyRequestUnavailable("API_KEY_CREATE_UNCERTAIN");
  }
}
