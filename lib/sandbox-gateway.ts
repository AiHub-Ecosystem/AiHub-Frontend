import { createHash } from "node:crypto";

/**
 * Transport shared by the public demo gateways.
 *
 * The host allowlist is the security boundary for every demo call, so it is
 * defined once here rather than copied per gateway: two copies of a pinned
 * hostname are two places to forget when the pin changes.
 *
 * Speaking-specific concerns — audio fields, parts, extensions, signed
 * assertion minting — stay in the Speaking gateway. Assertion minting is
 * Speaking-only by design: the backend route is allowlist-guarded rather than
 * scope-guarded and customer keys never use it.
 */

const SANDBOX_HOST = "sandbox.aihubproduction.com";

/**
 * The declared user id the demos send. Unowned public traffic needs no per
 * visitor identity, so it is a stable digest of a constant rather than a real
 * account. Deriving it keeps the value deterministic across builds and
 * processes.
 */
export const INTERNAL_USER_ID = `cu_${createHash("sha256")
  .update("aihub-internal\0speaking-demo", "utf8")
  .digest("base64url")}`;

export class SandboxBoundaryError extends Error {
  constructor() {
    super("sandbox-unavailable");
    this.name = "SandboxBoundaryError";
  }
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new SandboxBoundaryError();
  return value;
}

/**
 * The only hosts a demo will call. Production config must name the sandbox
 * host literally; a loopback mock is accepted in development only when it is
 * the one the environment explicitly declares, so a stray `BASE_URL` cannot
 * point a demo at a developer's machine.
 */
export function resolveSandboxBaseUrl() {
  const rawBaseUrl = required("AIHUB_SANDBOX_BASE_URL").replace(/\/+$/, "");
  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    throw new SandboxBoundaryError();
  }

  const isPinnedSandbox =
    baseUrl.protocol === "https:" &&
    baseUrl.hostname.toLowerCase() === SANDBOX_HOST &&
    baseUrl.port === "";
  const e2eMockBaseUrl =
    process.env.AIHUB_SANDBOX_E2E_MOCK_BASE_URL?.trim().replace(/\/+$/, "");
  const isConfiguredMock =
    process.env.NODE_ENV === "development" &&
    rawBaseUrl === e2eMockBaseUrl &&
    baseUrl.protocol === "http:" &&
    baseUrl.hostname === "127.0.0.1" &&
    !baseUrl.username &&
    !baseUrl.password;

  if (
    (!isPinnedSandbox && !isConfiguredMock) ||
    baseUrl.pathname !== "/" ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new SandboxBoundaryError();
  }

  return rawBaseUrl;
}

export function resolveSandboxConfig() {
  const baseUrl = resolveSandboxBaseUrl();
  const apiKey = required("AIHUB_SANDBOX_API_KEY");
  // Read for its absence only: an unconfigured deployment should fail here
  // rather than at the first call.
  required("AIHUB_SANDBOX_ORGANIZATION_ID");
  return { baseUrl, apiKey };
}

/**
 * The Signed User Assertion the sandbox expects in `X-User-Identity`.
 *
 * An Organization with an active identity configuration demands one, and the
 * resolver rejects a declared id outright rather than falling back — so a
 * declared id works only while that configuration is absent. Minting is the
 * only shape that holds either way, which is why both demo gateways do it.
 *
 * The mint route is allowlist-guarded and 404s when the sandbox has no
 * assertion key configured; both are reported as one boundary failure rather
 * than passed through, since neither tells a visitor anything useful.
 */
export async function mintSandboxAssertion(
  baseUrl: string,
  apiKey: string
): Promise<string> {
  let payload: unknown;
  try {
    const response = await fetch(`${baseUrl}/v1/sandbox/assertions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ user_id: INTERNAL_USER_ID }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) payload = await response.json();
  } catch {
    throw new SandboxBoundaryError();
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload) ||
    typeof payload.data !== "object" ||
    payload.data === null ||
    !("assertion" in payload.data) ||
    typeof payload.data.assertion !== "string" ||
    !payload.data.assertion.trim()
  ) {
    throw new SandboxBoundaryError();
  }

  return payload.data.assertion;
}

/**
 * CSRF guard. Returns true when the request is same-origin, and also when it
 * carries no Origin header at all — a non-browser client has none to forge,
 * and the demo pages are public.
 */
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const requestUrl = new URL(request.url);
    const forwardedProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();
    const protocol = forwardedProto || requestUrl.protocol.slice(0, -1);
    const host = request.headers.get("host") || requestUrl.host;
    const effectiveOrigin = new URL(`${protocol}://${host}`).origin;
    return new URL(origin).origin === effectiveOrigin;
  } catch {
    return false;
  }
}
