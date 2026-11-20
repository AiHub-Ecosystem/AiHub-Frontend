import {
  authenticatedAihubFetch,
  requireWebSession,
  webSessionIdFromRequest,
} from "@/lib/auth-session";
import { isAvatar, noStore, upstreamFailure } from "@/lib/account-avatar";

export async function GET(request: Request) {
  const denied = await requireWebSession(request);
  if (denied) return denied;
  const sessionId = webSessionIdFromRequest(request)!;
  try {
    // One upstream call per BFF request keeps DPoP proof relaying unambiguous.
    const upstream = await authenticatedAihubFetch(
      request,
      sessionId,
      "/v1/me/avatar"
    );
    if (!upstream.ok) return upstreamFailure(upstream, "ACCOUNT_UNAVAILABLE");

    const payload = (await upstream.json()) as {
      data?: { username?: unknown; avatar?: unknown };
    };
    if (
      typeof payload.data?.username !== "string" ||
      !payload.data.username.trim() ||
      !isAvatar(payload.data?.avatar)
    )
      return Response.json(
        { error: { code: "ACCOUNT_RESPONSE_INVALID" } },
        { status: 502, headers: noStore }
      );
    return Response.json(
      {
        data: { username: payload.data.username, avatar: payload.data.avatar },
      },
      { headers: noStore }
    );
  } catch {
    return Response.json(
      { error: { code: "ACCOUNT_UNAVAILABLE" } },
      { status: 503, headers: noStore }
    );
  }
}
