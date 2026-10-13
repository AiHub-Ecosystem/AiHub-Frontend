import {
  authenticatedAihubFetch,
  originIsAllowed,
  requireWebSession,
  webSessionIdFromRequest,
} from "@/lib/auth-session";
import {
  isAvatar,
  isAvatarAssetId,
  noStore,
  unavailable,
  upstreamFailure,
} from "@/lib/account-avatar";

type Context = { params: Promise<{ assetId: string }> };

export async function POST(request: Request, { params }: Context) {
  if (!originIsAllowed(request))
    return new Response(null, { status: 403, headers: noStore });
  const denied = await requireWebSession(request);
  if (denied) return denied;
  const { assetId } = await params;
  if (!isAvatarAssetId(assetId))
    return Response.json(
      { error: { code: "INVALID_AVATAR_ASSET_ID" } },
      { status: 400, headers: noStore }
    );

  try {
    const upstream = await authenticatedAihubFetch(
      request,
      webSessionIdFromRequest(request)!,
      `/v1/me/avatar/uploads/${assetId}/complete`,
      { method: "POST" }
    );
    if (!upstream.ok)
      return upstreamFailure(upstream, "AVATAR_CONFIRMATION_FAILED");
    const payload = (await upstream.json()) as { data?: unknown };
    if (!isAvatar(payload.data) || !payload.data)
      return unavailable("AVATAR_CONFIRMATION_RESPONSE_INVALID");
    return Response.json(
      { data: payload.data },
      { status: upstream.status, headers: noStore }
    );
  } catch {
    return unavailable("AVATAR_CONFIRMATION_UNAVAILABLE");
  }
}
