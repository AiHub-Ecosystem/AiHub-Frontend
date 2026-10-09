import {
  customerWebOrigin,
  isWebSessionId,
  logoutFromAihubBestEffort,
  originIsAllowed,
  webSessionCookie,
  webSessionIdFromRequest,
} from "@/lib/auth-session";

export async function POST(request: Request) {
  if (!originIsAllowed(request))
    return new Response(null, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });

  const token = webSessionIdFromRequest(request);
  if (isWebSessionId(token)) void logoutFromAihubBestEffort(token);

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
