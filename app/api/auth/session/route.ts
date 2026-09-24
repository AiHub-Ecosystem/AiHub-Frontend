import {
  isWebSessionId,
  originIsAllowed,
  touchWebSession,
  WEB_SESSION_COOKIE,
  WEB_SESSION_TTL_SECONDS,
} from "@/lib/auth-session";

function sessionCookie(value: string) {
  return `${WEB_SESSION_COOKIE}=${value}; Path=/; Max-Age=${WEB_SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

const clearCookie = `${WEB_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

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

  if (!isWebSessionId(sessionId)) {
    return new Response(null, {
      status: 401,
      headers: { "Cache-Control": "no-store", "Set-Cookie": clearCookie },
    });
  }
  try {
    const active = await touchWebSession(sessionId);
    return new Response(null, {
      status: active ? 204 : 401,
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": active ? sessionCookie(sessionId) : clearCookie,
      },
    });
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
