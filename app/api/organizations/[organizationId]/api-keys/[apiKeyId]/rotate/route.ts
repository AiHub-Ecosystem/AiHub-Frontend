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
  validApiKeyId,
  validOrganizationId,
} from "@/lib/organization-api-keys-bff";
import { parseMintedOrganizationApiKey } from "@/lib/api-keys";

type RouteContext = {
  params: Promise<{ organizationId: string; apiKeyId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  if (!originIsAllowed(request))
    return new Response(null, { status: 403, headers: apiKeyNoStore });
  const denied = await requireWebSession(request);
  if (denied) return denied;
  const { organizationId, apiKeyId } = await context.params;
  if (!validOrganizationId(organizationId) || !validApiKeyId(apiKeyId))
    return new Response(null, { status: 404, headers: apiKeyNoStore });

  try {
    const upstream = await authenticatedAihubFetch(
      webSessionIdFromRequest(request)!,
      `/v1/organizations/${encodeURIComponent(organizationId)}/api-keys/${encodeURIComponent(apiKeyId)}/rotate`,
      { method: "POST" }
    );
    return await forwardApiKeyResponse(upstream, (payload) => {
      const apiKey = parseMintedOrganizationApiKey(payload);
      return apiKey ? { data: apiKey } : null;
    });
  } catch {
    return apiKeyRequestUnavailable("API_KEY_ROTATE_UNCERTAIN");
  }
}
