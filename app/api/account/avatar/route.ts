import {
  authenticatedAihubFetch,
  originIsAllowed,
  requireWebSession,
  webSessionIdFromRequest,
} from "@/lib/auth-session";
import { noStore, unavailable, upstreamFailure } from "@/lib/account-avatar";

export async function DELETE(request: Request) {
  if (!originIsAllowed(request))
    return new Response(null, { status: 403, headers: noStore });
  const denied = await requireWebSession(request);
  if (denied) return denied;
  try {
    const upstream = await authenticatedAihubFetch(
      request,
      webSessionIdFromRequest(request)!,
      "/v1/me/avatar",
      { method: "DELETE" }
    );
    if (!upstream.ok) return upstreamFailure(upstream, "AVATAR_REMOVE_FAILED");
    return new Response(null, { status: 204, headers: noStore });
  } catch {
    return unavailable("AVATAR_REMOVE_UNAVAILABLE");
  }
}
