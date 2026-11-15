import {
  endUserIpFromHeaders,
  getCurrentWebSession,
  isWebSessionId,
  originIsAllowed,
  WEB_SESSION_TTL_SECONDS,
  appendExpiredWebSessionCookies,
  expiredLegacyWebSessionCookie,
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
      headers: appendExpiredWebSessionCookies(new Headers(noStore)),
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
        headers: appendExpiredWebSessionCookies(new Headers(noStore)),
      });
    const headers = new Headers(noStore);
    headers.append(
      "Set-Cookie",
      webSessionCookie(token, WEB_SESSION_TTL_SECONDS)
    );
    headers.append("Set-Cookie", expiredLegacyWebSessionCookie());
    return new Response(null, {
      status: 204,
      headers,
    });
  } catch {
    return new Response(null, { status: 503, headers: noStore });
  }
}
