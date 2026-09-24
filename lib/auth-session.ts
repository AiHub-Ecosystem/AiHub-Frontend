import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "redis";

export const WEB_SESSION_COOKIE = "__Host-aihub_web_session";
export const AIHUB_REFRESH_COOKIE = "__Host-aihub_refresh";
export const WEB_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export function webSessionCookie(value: string, maxAge: number) {
  return `${WEB_SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

type WebSession = {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
};

const SESSION_PREFIX = "customer-web:session:";
const REFRESH_LOCK_PREFIX = "customer-web:refresh-lock:";
const REFRESH_EARLY_MS = 60_000;
const REFRESH_LOCK_MS = 15_000;
const REFRESH_WAIT_MS = 12_000;

let redisClient: ReturnType<typeof createClient> | undefined;
let redisConnection: Promise<ReturnType<typeof createClient>> | undefined;
let redisErrorLogged = false;

async function redis() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required");

  if (!redisClient) {
    redisClient = createClient({
      url,
      socket: { connectTimeout: 5_000, reconnectStrategy: false },
    });
    redisClient.on("error", () => {
      if (!redisErrorLogged) console.error("[auth] Redis connection error");
      redisErrorLogged = true;
    });
    redisClient.on("ready", () => {
      redisErrorLogged = false;
    });
  }
  if (!redisClient.isReady) {
    redisConnection ??= redisClient
      .connect()
      .then(() => redisClient!)
      .finally(() => {
        redisConnection = undefined;
      });
    await redisConnection;
  }
  return redisClient;
}

function sessionKey(id: string) {
  return `${SESSION_PREFIX}${id}`;
}

export function isWebSessionId(value: string | undefined): value is string {
  return !!value && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export async function getWebSession(id: string): Promise<WebSession | null> {
  if (!isWebSessionId(id)) return null;
  const stored = await (await redis()).get(sessionKey(id));
  if (!stored) return null;
  try {
    const session = JSON.parse(stored) as WebSession;
    return typeof session.accessToken === "string" &&
      session.accessToken.length > 0 &&
      Number.isFinite(session.accessTokenExpiresAt) &&
      typeof session.refreshToken === "string" &&
      session.refreshToken.length > 0
      ? session
      : null;
  } catch {
    return null;
  }
}

async function saveWebSession(id: string, session: WebSession) {
  await (
    await redis()
  ).set(sessionKey(id), JSON.stringify(session), {
    expiration: { type: "EX", value: WEB_SESSION_TTL_SECONDS },
  });
}

async function saveRefreshedWebSession(
  id: string,
  session: WebSession,
  lockKey: string,
  lockValue: string
) {
  return (
    (await (
      await redis()
    ).eval(
      "if redis.call('GET', KEYS[2]) == ARGV[2] and redis.call('EXISTS', KEYS[1]) == 1 then return redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3]) else return 0 end",
      {
        keys: [sessionKey(id), lockKey],
        arguments: [
          JSON.stringify(session),
          lockValue,
          String(WEB_SESSION_TTL_SECONDS),
        ],
      }
    )) === "OK"
  );
}

export async function createWebSession(session: WebSession): Promise<string> {
  const id = randomBytes(32).toString("base64url");
  await saveWebSession(id, session);
  return id;
}

export async function deleteWebSession(id: string) {
  await (await redis()).del(sessionKey(id));
}

export async function touchWebSession(id: string) {
  if (!(await getWebSession(id))) return false;
  return (await redis()).expire(sessionKey(id), WEB_SESSION_TTL_SECONDS);
}

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

export function extractRefreshToken(headers: Headers) {
  const setCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie") ?? ""];
  const cookie = setCookies.find((value) =>
    value.startsWith(`${AIHUB_REFRESH_COOKIE}=`)
  );
  const pair = cookie?.split(";", 1)[0];
  const value = pair?.slice(AIHUB_REFRESH_COOKIE.length + 1);
  return value && /^[\x21-\x3A\x3C-\x7E]+$/.test(value) ? value : null;
}

async function refreshWebSession(
  id: string,
  previousAccessToken?: string
): Promise<WebSession | null> {
  const lockKey = `${REFRESH_LOCK_PREFIX}${id}`;
  const lockValue = randomUUID();
  const redisClient = await redis();
  const deadline = Date.now() + REFRESH_WAIT_MS;

  while (Date.now() < deadline) {
    const locked = await redisClient.set(lockKey, lockValue, {
      condition: "NX",
      expiration: { type: "PX", value: REFRESH_LOCK_MS },
    });

    if (locked) {
      try {
        const latest = await getWebSession(id);
        if (!latest) return null;
        if (previousAccessToken && latest.accessToken !== previousAccessToken)
          return latest;
        if (
          !previousAccessToken &&
          latest.accessTokenExpiresAt > Date.now() + REFRESH_EARLY_MS
        )
          return latest;

        const response = await fetch(aihubUrl("/v1/auth/refresh"), {
          method: "POST",
          headers: { Cookie: `${AIHUB_REFRESH_COOKIE}=${latest.refreshToken}` },
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        });
        if (response.status === 401) {
          await deleteWebSession(id);
          return null;
        }
        if (!response.ok)
          throw new Error(`AIHUB refresh failed (${response.status})`);

        const body = (await response.json()) as {
          data?: { access_token?: unknown; expires_in?: unknown };
        };
        const refreshToken = extractRefreshToken(response.headers);
        if (
          typeof body.data?.access_token !== "string" ||
          !body.data.access_token ||
          typeof body.data.expires_in !== "number" ||
          !Number.isFinite(body.data.expires_in) ||
          body.data.expires_in <= 0 ||
          body.data.expires_in > 900 ||
          !refreshToken
        ) {
          throw new Error("AIHUB refresh response is invalid");
        }

        const updated = {
          accessToken: body.data.access_token,
          accessTokenExpiresAt: Date.now() + body.data.expires_in * 1000,
          refreshToken,
        };
        if (!(await saveRefreshedWebSession(id, updated, lockKey, lockValue)))
          return null;
        return updated;
      } finally {
        await redisClient.eval(
          "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
          { keys: [lockKey], arguments: [lockValue] }
        );
      }
    }

    const latest = await getWebSession(id);
    if (!latest) return null;
    if (previousAccessToken && latest.accessToken !== previousAccessToken)
      return latest;
    if (
      !previousAccessToken &&
      latest.accessTokenExpiresAt > Date.now() + REFRESH_EARLY_MS
    )
      return latest;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for AIHUB token refresh");
}

export async function getCurrentWebSession(id: string) {
  const session = await getWebSession(id);
  if (!session) return null;
  return session.accessTokenExpiresAt <= Date.now() + REFRESH_EARLY_MS
    ? refreshWebSession(id)
    : session;
}

export async function authenticatedAihubFetch(
  id: string,
  path: string,
  init: RequestInit = {}
) {
  const destination = new URL(path, aihubUrl("/"));
  if (destination.origin !== new URL(aihubUrl("/")).origin)
    throw new Error("AIHUB path must be same-origin");

  let session = await getCurrentWebSession(id);
  if (!session) return new Response(null, { status: 401 });
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

  session = await refreshWebSession(id, session.accessToken);
  return session ? send(session.accessToken) : response;
}

export async function logoutFromAihub(refreshToken: string) {
  return fetch(aihubUrl("/v1/auth/logout"), {
    method: "POST",
    headers: { Cookie: `${AIHUB_REFRESH_COOKIE}=${refreshToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
}
