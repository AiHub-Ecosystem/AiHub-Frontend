const SANDBOX_HOST = "sandbox.aihubproduction.com";

export class SandboxBoundaryError extends Error {
  constructor() {
    super("sandbox-unavailable");
    this.name = "SandboxBoundaryError";
  }
}

export class DemoCredentialError extends Error {
  constructor(readonly code: "UNAUTHORIZED" | "INVALID_USER_IDENTITY") {
    super(code);
    this.name = "DemoCredentialError";
  }
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new SandboxBoundaryError();
  return value;
}

/** The BFF can call only the configured AIHUB Sandbox host. */
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

export function readDemoApiKey(request: Request) {
  const value = request.headers.get("x-demo-api-key")?.trim();
  if (!value || value.length > 512) throw new DemoCredentialError("UNAUTHORIZED");
  return value;
}

export function readDemoUserIdentity(request: Request) {
  const value = request.headers.get("x-demo-user-identity")?.trim();
  if (
    !value ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new DemoCredentialError("INVALID_USER_IDENTITY");
  }
  return value;
}

/** CSRF guard for the same-origin Browser-to-BFF requests. */
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
