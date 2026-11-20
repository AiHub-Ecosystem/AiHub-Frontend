import aihubLimits from "@/data/aihub-contract/limits.json";
import {
  appendExpiredWebSessionCookies,
  isWebSessionId,
  webSessionCookie,
  webSessionIdFromRequest,
} from "@/lib/auth-cookies";
import {
  accessTokenHash,
  createDpopChallenge,
  DPOP_CHALLENGE_HEADER,
  DPOP_INVALID_CODE,
  DPOP_REQUEST_CHALLENGE_HEADER,
  DPOP_REQUEST_PROOF_HEADER,
  DPOP_REQUEST_PROOFS_HEADER,
  DPOP_REQUIRED_CODE,
  verifyDpopChallenge,
} from "@/lib/dpop-challenge";
import {
  proofKeyFromCookieHeader,
  type PublicProofKey,
} from "@/lib/public-proof-key.mjs";

export * from "@/lib/auth-cookies";
export type { PublicProofKey } from "@/lib/public-proof-key.mjs";

export const WEB_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const ACCESS_TOKEN_EARLY_MS = 60_000;

export function endUserIpFromHeaders(headers: Pick<Headers, "get">) {
  // The VPS nginx overwrites X-Real-IP; AIHUB validates it at the trust boundary.
  return headers.get("x-real-ip") ?? undefined;
}

type WebSession = {
  accessToken: string;
  accessTokenExpiresAt: number;
  dpopBound: boolean;
};

const sessions = new Map<string, WebSession>();
const exchanges = new Map<string, Promise<WebSession | null>>();

/** The public JWK travels on every BFF request, so any instance can relay it. */
export function clientProofKeyFromHeaders(
  headers: Pick<Headers, "get">
): PublicProofKey | null {
  return proofKeyFromCookieHeader(headers.get("cookie"));
}

export function safeLocalPath(
  value: string | null | undefined,
  fallback = "/app/console"
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
    if (parsed.origin !== origin) return fallback;
    const pathname =
      parsed.pathname === "/app" || parsed.pathname.startsWith("/app/")
        ? parsed.pathname
        : `/app${parsed.pathname}`;
    return `${pathname}${parsed.search}${parsed.hash}`;
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
  endUserIp: string | undefined,
  proofKey: PublicProofKey | null
): Promise<WebSession | null> {
  if (!isWebSessionId(token)) return null;
  let response: Response;
  try {
    response = await postAihubWebSession(
      "/v1/auth/web-sessions/exchange",
      {
        web_session_token: token,
        ...(proofKey ? { client_proof_key: proofKey } : {}),
      },
      endUserIp
    );
  } catch {
    throw new Error("AIHUB Web Session exchange failed");
  }
  if (response.status === 400 && proofKey) {
    // An AIHUB image from before contract 1.18 rejects the unknown request
    // member. Retry unbound so Bearer sign-in keeps working across the rollout.
    try {
      response = await postAihubWebSession(
        "/v1/auth/web-sessions/exchange",
        { web_session_token: token },
        endUserIp
      );
    } catch {
      throw new Error("AIHUB Web Session exchange failed");
    }
  }
  if (response.status === 401) {
    sessions.delete(token);
    return null;
  }
  if (!response.ok) throw new Error("AIHUB Web Session exchange failed");

  const body = (await response.json()) as {
    data?: {
      access_token?: unknown;
      expires_in?: unknown;
      dpop_bound?: unknown;
    };
  };
  const accessToken = body.data?.access_token;
  const expiresIn = body.data?.expires_in;
  if (
    typeof accessToken !== "string" ||
    !accessToken ||
    typeof expiresIn !== "number" ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0 ||
    expiresIn > aihubLimits.webSessionAccessTokenMaxSeconds
  ) {
    throw new Error("AIHUB Web Session response is invalid");
  }
  const session = {
    accessToken,
    accessTokenExpiresAt: Date.now() + expiresIn * 1000,
    dpopBound: body.data?.dpop_bound === true,
  };
  pruneExpiredSessions();
  sessions.set(token, session);
  return session;
}

// A session the browser abandons is never looked up again, so its entry would
// otherwise stay for the life of the process. Expired entries are useless: the
// next lookup exchanges again either way. The sweep runs at most once a minute,
// so a burst of exchanges costs one pass over the cache, not one pass each.
const PRUNE_INTERVAL_MS = 60_000;
let lastPrunedAt = 0;

function pruneExpiredSessions(now = Date.now()) {
  if (now - lastPrunedAt < PRUNE_INTERVAL_MS) return;
  lastPrunedAt = now;
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
  endUserIp: string | undefined,
  proofKey: PublicProofKey | null = null
) {
  if (!isWebSessionId(token)) return null;
  let cached = sessions.get(token);
  if (cached && proofKey && !cached.dpopBound) {
    sessions.delete(token);
    cached = undefined;
  }
  if (
    cached &&
    cached.accessTokenExpiresAt > Date.now() + ACCESS_TOKEN_EARLY_MS
  )
    return cached;

  let exchange = exchanges.get(token);
  if (!exchange) {
    exchange = exchangeWebSession(token, endUserIp, proofKey).finally(() =>
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
      await getCurrentWebSession(
        token,
        endUserIpFromHeaders(request.headers),
        clientProofKeyFromHeaders(request.headers)
      )
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
    response.headers.get("set-cookie")?.includes(cookie)
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
      headers: appendExpiredWebSessionCookies(new Headers(headers)),
    }
  );
}

function dpopProofClaims(proof: string) {
  const [, payload] = proof.split(".");
  if (!payload) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as {
      htm?: unknown;
      htu?: unknown;
      ath?: unknown;
      jti?: unknown;
      iat?: unknown;
    };
    if (
      typeof parsed.htm !== "string" ||
      typeof parsed.htu !== "string" ||
      typeof parsed.ath !== "string" ||
      typeof parsed.jti !== "string" ||
      typeof parsed.iat !== "number"
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

function dpopResponse(code: string, challenge?: string) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  });
  if (challenge) headers.set(DPOP_CHALLENGE_HEADER, challenge);
  return Response.json(
    { success: false, error: { code } },
    { status: code === DPOP_REQUIRED_CODE ? 428 : 400, headers }
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

  const method = (init.method ?? "GET").toUpperCase();
  const htu = `${destination.origin}${destination.pathname}`;
  const endUserIp = endUserIpFromHeaders(request.headers);
  const proofKey = clientProofKeyFromHeaders(request.headers);
  let session = await getCurrentWebSession(token, endUserIp, proofKey);
  if (!session)
    return authRequired({
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    });

  const descriptor = {
    sessionToken: token,
    method,
    url: htu,
    accessToken: session.accessToken,
  };
  const challenge = request.headers.get(DPOP_REQUEST_CHALLENGE_HEADER);
  const proofsHeader = request.headers.get(DPOP_REQUEST_PROOFS_HEADER);
  let proofs: Record<string, string> = {};
  if (proofsHeader) {
    try {
      const parsed = JSON.parse(proofsHeader) as Record<string, unknown>;
      if (parsed && typeof parsed === "object")
        for (const [key, value] of Object.entries(parsed))
          if (typeof value === "string") proofs[key] = value;
    } catch {}
  }
  const proof = proofs[htu] ?? request.headers.get(DPOP_REQUEST_PROOF_HEADER);
  if (session.dpopBound) {
    // A BFF route may call several upstream URLs; the browser can carry one
    // proof per htu. Only the call still missing its proof needs a challenge.
    if (!proof && !verifyDpopChallenge(challenge, descriptor)) {
      console.info("[dpop] challenge issued", method, htu);
      return dpopResponse(DPOP_REQUIRED_CODE, createDpopChallenge(descriptor));
    }
    const claims = proof ? dpopProofClaims(proof) : null;
    if (
      !claims ||
      claims.htm !== method ||
      claims.htu !== htu ||
      claims.ath !== accessTokenHash(session.accessToken)
    ) {
      console.info("[dpop] proof rejected", method, htu);
      return dpopResponse(DPOP_INVALID_CODE);
    }
    console.info("[dpop] proof relayed", method, htu);
  }

  const send = (accessToken: string) => {
    const headers = new Headers(init.headers);
    if (session!.dpopBound) {
      headers.set("Authorization", `DPoP ${accessToken}`);
      headers.set("DPoP", proof!);
    } else {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
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
  session = await getCurrentWebSession(token, endUserIp, proofKey);
  if (!session)
    return authRequired({
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    });
  if (!session.dpopBound) return send(session.accessToken);
  return dpopResponse(
    DPOP_REQUIRED_CODE,
    createDpopChallenge({ ...descriptor, accessToken: session.accessToken })
  );
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
