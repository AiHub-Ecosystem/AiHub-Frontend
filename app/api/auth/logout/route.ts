import {
  deleteWebSession,
  getWebSession,
  isWebSessionId,
  logoutFromAihub,
  customerWebOrigin,
  originIsAllowed,
  WEB_SESSION_COOKIE,
  webSessionCookie,
} from "@/lib/auth-session";

export async function POST(request: Request) {
  if (!originIsAllowed(request))
    return new Response(null, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });

  const sessionId = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${WEB_SESSION_COOKIE}=`))
    ?.slice(WEB_SESSION_COOKIE.length + 1);

  if (isWebSessionId(sessionId)) {
    let refreshToken: string | undefined;
    try {
      const session = await getWebSession(sessionId);
      refreshToken = session?.refreshToken;
    } catch {
      console.warn("[auth] Could not read Web Session during logout");
    }
    try {
      await deleteWebSession(sessionId);
    } catch {
      console.error("[auth] Could not delete Web Session during logout");
    }
    if (refreshToken) {
      try {
        const upstream = await logoutFromAihub(refreshToken);
        if (!upstream.ok)
          console.warn("[auth] AIHUB logout returned non-success");
      } catch {
        console.warn("[auth] AIHUB logout request failed");
      }
    }
  }

  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      "Clear-Site-Data": '"cache"',
      Location: new URL("/", customerWebOrigin()).toString(),
      "Set-Cookie": webSessionCookie("", 0),
    },
  });
}
