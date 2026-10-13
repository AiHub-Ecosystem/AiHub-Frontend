import {
  endUserIpFromHeaders,
  getCurrentWebSession,
  isWebSessionId,
  originIsAllowed,
  WEB_SESSION_TTL_SECONDS,
  webSessionCookie,
  webSessionIdFromRequest,
} from "@/lib/auth-session";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!originIsAllowed(request))
    return new Response(null, { status: 403, headers: noStore });
  const token = webSessionIdFromRequest(request);

  if (!isWebSessionId(token))
    return new Response(null, {
      status: 401,
      headers: { ...noStore, "Set-Cookie": webSessionCookie("", 0) },
    });

  try {
    if (
      !(await getCurrentWebSession(
        token,
        endUserIpFromHeaders(request.headers)
      ))
    )
      return new Response(null, {
        status: 401,
        headers: { ...noStore, "Set-Cookie": webSessionCookie("", 0) },
      });
    return new Response(null, {
      status: 204,
      headers: {
        ...noStore,
        "Set-Cookie": webSessionCookie(token, WEB_SESSION_TTL_SECONDS),
      },
    });
  } catch {
    return new Response(null, { status: 503, headers: noStore });
  }
}
