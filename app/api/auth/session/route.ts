import {
  isWebSessionId,
  originIsAllowed,
  touchWebSession,
  WEB_SESSION_TTL_SECONDS,
  webSessionIdFromRequest,
  webSessionCookie,
} from "@/lib/auth-session";

export async function POST(request: Request) {
  if (!originIsAllowed(request))
    return new Response(null, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  const sessionId = webSessionIdFromRequest(request);

  if (!isWebSessionId(sessionId)) {
    return new Response(null, {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": webSessionCookie("", 0),
      },
    });
  }
  try {
    const active = await touchWebSession(sessionId);
    return new Response(null, {
      status: active ? 204 : 401,
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": webSessionCookie(
          active ? sessionId : "",
          active ? WEB_SESSION_TTL_SECONDS : 0
        ),
      },
    });
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
