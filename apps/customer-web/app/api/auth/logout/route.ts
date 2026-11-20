import {
  customerWebOrigin,
  endUserIpFromHeaders,
  isWebSessionId,
  logoutFromAihubBestEffort,
  originIsAllowed,
  appendExpiredWebSessionCookies,
  webSessionIdFromRequest,
} from "@/lib/auth-session";
import {
  expiredProofKeyCookies,
  expiredProofScopeCookie,
} from "@/lib/public-proof-key.mjs";

export async function POST(request: Request) {
  if (!originIsAllowed(request))
    return new Response(null, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });

  const token = webSessionIdFromRequest(request);
  if (isWebSessionId(token))
    void logoutFromAihubBestEffort(
      token,
      endUserIpFromHeaders(request.headers)
    );

  const headers = appendExpiredWebSessionCookies(
    new Headers({
      "Cache-Control": "no-store",
      "Clear-Site-Data": '"cache"',
      Location: new URL("/", customerWebOrigin()).toString(),
    })
  );
  headers.append("Set-Cookie", expiredProofKeyCookies());
  headers.append("Set-Cookie", expiredProofScopeCookie());
  return new Response(null, { status: 303, headers });
}
