import {
  authenticatedAihubFetch,
  originIsAllowed,
  requireWebSession,
  webSessionIdFromRequest,
} from "@/lib/auth-session";
import { noStore, unavailable, upstreamFailure } from "@/lib/account-avatar";

type Context = { params: Promise<{ assetId: string }> };

export async function POST(request: Request, { params }: Context) {
  if (!originIsAllowed(request))
    return new Response(null, { status: 403, headers: noStore });
  const denied = await requireWebSession(request);
  if (denied) return denied;
  const { assetId } = await params;
  if (!/^ava_[0-9A-HJKMNP-TV-Z]{26}$/.test(assetId))
    return Response.json(
      { error: { code: "INVALID_AVATAR_ASSET_ID" } },
      { status: 400, headers: noStore }
    );

  try {
    const upstream = await authenticatedAihubFetch(
      webSessionIdFromRequest(request)!,
      `/v1/me/avatar/uploads/${assetId}/complete`,
      { method: "POST" }
    );
    if (!upstream.ok)
      return upstreamFailure(upstream, "AVATAR_CONFIRMATION_FAILED");
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { ...noStore, "Content-Type": "application/json" },
    });
  } catch {
    return unavailable("AVATAR_CONFIRMATION_UNAVAILABLE");
  }
}
