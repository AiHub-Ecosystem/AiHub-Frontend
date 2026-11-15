import {
  authenticatedAihubFetch,
  requireWebSession,
  webSessionIdFromRequest,
} from "@/lib/auth-session";
import {
  isAvatar,
  noStore,
  unavailable,
  upstreamFailure,
} from "@/lib/account-avatar";

export async function GET(request: Request) {
  const denied = await requireWebSession(request);
  if (denied) return denied;
  const sessionId = webSessionIdFromRequest(request)!;
  try {
    const [identity, avatar] = await Promise.all([
      authenticatedAihubFetch(request, sessionId, "/v1/me"),
      authenticatedAihubFetch(request, sessionId, "/v1/me/avatar"),
    ]);
    if (!identity.ok) return upstreamFailure(identity, "ACCOUNT_UNAVAILABLE");
    if (!avatar.ok) return upstreamFailure(avatar, "AVATAR_UNAVAILABLE");

    const [identityBody, avatarBody] = (await Promise.all([
      identity.json(),
      avatar.json(),
    ])) as [{ data?: { username?: unknown } }, { data?: { avatar?: unknown } }];
    if (
      typeof identityBody.data?.username !== "string" ||
      !identityBody.data.username.trim() ||
      !isAvatar(avatarBody.data?.avatar)
    ) {
      return unavailable("ACCOUNT_RESPONSE_INVALID");
    }
    return Response.json(
      {
        data: {
          username: identityBody.data.username,
          avatar: avatarBody.data.avatar,
        },
      },
      { headers: noStore }
    );
  } catch {
    return unavailable("ACCOUNT_UNAVAILABLE");
  }
}
