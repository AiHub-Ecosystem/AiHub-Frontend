import {
  isWebSessionId,
  webSessionCookie,
  webSessionIdFromRequest,
} from "@/lib/auth-cookies";

export * from "@/lib/auth-cookies";

export const WEB_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const ACCESS_TOKEN_EARLY_MS = 60_000;

export function endUserIpFromHeaders(headers: Pick<Headers, "get">) {
  // The VPS nginx overwrites X-Real-IP; AIHUB validates it at the trust boundary.
  return headers.get("x-real-ip") ?? undefined;
}

type WebSession = {
  accessToken: string;
  accessTokenExpiresAt: number;
};

const sessions = new Map<string, WebSession>();
const exchanges = new Map<string, Promise<WebSession | null>>();

export function safeLocalPath(
  value: string | null | undefined,
  fallback = "/console"
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f]/.test(value)
  ) {
    return fallback;
  }
  const origin = customerWebOrigin();
  try {
    const parsed = new URL(value, origin);
    return parsed.origin === origin
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

export function customerWebOrigin() {
  const configured = process.env.CUSTOMER_WEB_ORIGIN;
  if (!configured) throw new Error("CUSTOMER_WEB_ORIGIN is required");
  return new URL(configured).origin;
}

export function originIsAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return origin === customerWebOrigin();
  } catch {
    return false;
  }
}

export function aihubUrl(path: string) {
  const base = process.env.AIHUB_BASE_URL;
  if (!base) throw new Error("AIHUB_BASE_URL is required");
  return `${base.replace(/\/$/, "")}${path}`;
}

function clientSecret() {
  const secret = process.env.AIHUB_WEB_SESSION_CLIENT_SECRET;
  const required =
    process.env.NODE_ENV === "production" ||
    ["production", "staging"].includes(
      process.env.APP_ENV?.toLowerCase() ?? ""
    );
  if (required && !secret)
    throw new Error("AIHUB Web Session secret is required");
  return secret;
}

export async function postAihubWebSession(
  path: string,
  body: unknown,
  endUserIp: string | undefined
) {
  const secret = clientSecret();
  return fetch(aihubUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "X-AIHUB-Client-Secret": secret } : {}),
      ...(endUserIp ? { "X-AIHUB-End-User-IP": endUserIp } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
}

export async function readCreatedWebSession(response: Response) {
  const body = (await response.json()) as {
    data?: { web_session_token?: unknown; expires_at?: unknown };
  };
  const token = body.data?.web_session_token;
  const expiresAt = body.data?.expires_at;
  if (
    typeof token !== "string" ||
    !isWebSessionId(token) ||
    typeof expiresAt !== "string" ||
    !Number.isFinite(Date.parse(expiresAt))
  ) {
    throw new Error("AIHUB Web Session response is invalid");
  }
  return token;
}

async function exchangeWebSession(
  token: string,
  endUserIp: string | undefined
): Promise<WebSession | null> {
  if (!isWebSessionId(token)) return null;
  let response: Response;
  try {
    response = await postAihubWebSession(
      "/v1/auth/web-sessions/exchange",
      {
        web_session_token: token,
      },
      endUserIp
    );
  } catch {
    throw new Error("AIHUB Web Session exchange failed");
  }
  if (response.status === 401) {
    sessions.delete(token);
    return null;
  }
  if (!response.ok) throw new Error("AIHUB Web Session exchange failed");

  const body = (await response.json()) as {
    data?: { access_token?: unknown; expires_in?: unknown };
  };
  const accessToken = body.data?.access_token;
  const expiresIn = body.data?.expires_in;
  if (
    typeof accessToken !== "string" ||
    !accessToken ||
    typeof expiresIn !== "number" ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0 ||
    expiresIn > 900
  ) {
    throw new Error("AIHUB Web Session response is invalid");
  }
  const session = {
    accessToken,
    accessTokenExpiresAt: Date.now() + expiresIn * 1000,
  };
  pruneExpiredSessions();
  sessions.set(token, session);
  return session;
}

// A session the browser abandons is never looked up again, so its entry would
// otherwise stay for the life of the process. Expired entries are useless: the
// next lookup exchanges again either way.
function pruneExpiredSessions(now = Date.now()) {
  for (const [token, session] of sessions) {
    if (session.accessTokenExpiresAt <= now) sessions.delete(token);
  }
}

/** Test seam: how many access tokens the process currently holds. */
export function cachedWebSessionCount() {
  return sessions.size;
}

export async function getCurrentWebSession(
  token: string,
  endUserIp: string | undefined
) {
  if (!isWebSessionId(token)) return null;
  const cached = sessions.get(token);
  if (
    cached &&
    cached.accessTokenExpiresAt > Date.now() + ACCESS_TOKEN_EARLY_MS
  )
    return cached;

  let exchange = exchanges.get(token);
  if (!exchange) {
    exchange = exchangeWebSession(token, endUserIp).finally(() =>
      exchanges.delete(token)
    );
    exchanges.set(token, exchange);
  }
  return exchange;
}

export function clearWebSessionCache(token: string) {
  sessions.delete(token);
}

export async function requireWebSession(request: Request) {
  const token = webSessionIdFromRequest(request);
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  };

  if (!isWebSessionId(token)) return authRequired(headers);

  try {
    if (
      await getCurrentWebSession(token, endUserIpFromHeaders(request.headers))
    )
      return null;
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "AUTH_UNAVAILABLE", message: "Sign-in is unavailable." },
      }),
      { status: 503, headers }
    );
  }
  return authRequired(headers);
}

export function rejectedWebSessionCookie(response: Response) {
  const cookie = webSessionCookie("", 0);
  return response.status === 401 &&
    response.headers.get("set-cookie") === cookie
    ? cookie
    : null;
}

function authRequired(headers: Record<string, string>) {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code: "AUTH_REQUIRED", message: "Sign-in required." },
    }),
    {
      status: 401,
      headers: {
        ...headers,
        "Set-Cookie": webSessionCookie("", 0),
      },
    }
  );
}

export async function authenticatedAihubFetch(
  request: Request,
  token: string,
  path: string,
  init: RequestInit = {}
) {
  const destination = new URL(path, aihubUrl("/"));
  if (destination.origin !== new URL(aihubUrl("/")).origin)
    throw new Error("AIHUB path must be same-origin");

  const endUserIp = endUserIpFromHeaders(request.headers);
  let session = await getCurrentWebSession(token, endUserIp);
  if (!session)
    return authRequired({
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    });
  const send = (accessToken: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(destination, {
      ...init,
      headers,
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(8_000),
    });
  };
  const response = await send(session.accessToken);
  if (response.status !== 401) return response;

  sessions.delete(token);
  session = await getCurrentWebSession(token, endUserIp);
  return session
    ? send(session.accessToken)
    : authRequired({
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      });
}

export async function logoutFromAihubBestEffort(
  token: string,
  endUserIp: string | undefined
) {
  if (!isWebSessionId(token)) return;
  clearWebSessionCache(token);
  try {
    const response = await postAihubWebSession(
      "/v1/auth/web-sessions/logout",
      {
        web_session_token: token,
      },
      endUserIp
    );
    if (!response.ok) console.warn("[auth] AIHUB logout returned non-success");
  } catch {
    console.warn("[auth] AIHUB logout request failed");
  }
}
