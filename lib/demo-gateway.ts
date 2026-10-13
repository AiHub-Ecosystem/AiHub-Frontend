import { isIP } from "node:net";

import {
  demoEnvironmentHost,
  type DemoEnvironment,
} from "@/lib/demo-environments";

export class DemoBoundaryError extends Error {
  constructor() {
    super("demo-host-unavailable");
    this.name = "DemoBoundaryError";
  }
}

export class DemoCredentialError extends Error {
  constructor(readonly code: "UNAUTHORIZED" | "INVALID_USER_IDENTITY") {
    super(code);
    this.name = "DemoCredentialError";
  }
}

const BASE_URL_VARIABLE: Record<DemoEnvironment, string> = {
  sandbox: "AIHUB_SANDBOX_BASE_URL",
  production: "AIHUB_PRODUCTION_BASE_URL",
};

const MOCK_URL_VARIABLE: Record<DemoEnvironment, string> = {
  sandbox: "AIHUB_SANDBOX_E2E_MOCK_BASE_URL",
  production: "AIHUB_PRODUCTION_E2E_MOCK_BASE_URL",
};

function productionLike() {
  return (
    process.env.NODE_ENV === "production" ||
    ["production", "staging"].includes(process.env.APP_ENV?.toLowerCase() ?? "")
  );
}

/**
 * Attach the server-only BFF credential and the rightmost address appended by
 * the trusted ingress proxy; AIHUB uses that address for visitor-scoped abuse
 * counters instead of grouping all demo visitors under one BFF egress IP.
 */
export function demoBffHeaders(request: Request): HeadersInit {
  const secret = process.env.AIHUB_WEB_SESSION_CLIENT_SECRET?.trim();
  const required = productionLike();
  if (required && !secret) throw new DemoBoundaryError();

  const forwardedFor = request.headers.get("x-forwarded-for");
  const visitorIp = forwardedFor?.split(",").at(-1)?.trim();
  if (!visitorIp || isIP(visitorIp) === 0) {
    if (required) throw new DemoBoundaryError();
    return {
      ...(secret ? { "X-AIHUB-Client-Secret": secret } : {}),
      "X-AIHUB-Visitor-IP": "127.0.0.1",
    };
  }

  return {
    ...(secret ? { "X-AIHUB-Client-Secret": secret } : {}),
    "X-AIHUB-Visitor-IP": visitorIp,
  };
}

/**
 * The BFF calls only the fixed HTTPS host of the environment the demo selected.
 * A missing or unpinned base URL is an error, never a fallback to the other
 * environment's host: silently switching tiers is what this boundary forbids
 * (ADR-0018).
 */
export function resolveDemoBaseUrl(environment: DemoEnvironment) {
  const rawBaseUrl = process.env[BASE_URL_VARIABLE[environment]]
    ?.trim()
    .replace(/\/+$/, "");
  if (!rawBaseUrl) throw new DemoBoundaryError();

  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    throw new DemoBoundaryError();
  }

  const isPinned =
    baseUrl.protocol === "https:" &&
    baseUrl.hostname.toLowerCase() ===
      new URL(demoEnvironmentHost(environment)).hostname &&
    baseUrl.port === "";
  const e2eMockBaseUrl = process.env[MOCK_URL_VARIABLE[environment]]
    ?.trim()
    .replace(/\/+$/, "");
  const isConfiguredMock =
    process.env.NODE_ENV === "development" &&
    rawBaseUrl === e2eMockBaseUrl &&
    baseUrl.protocol === "http:" &&
    baseUrl.hostname === "127.0.0.1" &&
    !baseUrl.username &&
    !baseUrl.password;

  if (
    (!isPinned && !isConfiguredMock) ||
    baseUrl.pathname !== "/" ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new DemoBoundaryError();
  }

  return rawBaseUrl;
}

export function readDemoApiKey(request: Request) {
  const value = request.headers.get("x-demo-api-key")?.trim();
  if (!value || value.length > 512)
    throw new DemoCredentialError("UNAUTHORIZED");
  return value;
}

export function readDemoUserIdentity(request: Request) {
  const value = request.headers.get("x-demo-user-identity")?.trim();
  if (
    !value ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    throw new DemoCredentialError("INVALID_USER_IDENTITY");
  }
  return value;
}

/**
 * The environment the demo selected, as the browser states it. It only chooses
 * the host below; the key and the Organization's policy stay authoritative.
 * A route that reads it rejects anything else with its own invalid-request
 * error, because a wrong tier is the caller's mistake, not a boundary breach.
 */
export function isDemoEnvironment(
  value: string | null | undefined
): value is DemoEnvironment {
  return value === "sandbox" || value === "production";
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
