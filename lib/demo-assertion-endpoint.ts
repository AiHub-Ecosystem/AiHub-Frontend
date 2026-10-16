import {
  isDemoUserIdentity,
  MAX_SIGNED_USER_ASSERTION_BYTES,
} from "./demo-identity";

const GENERIC_FAILURE =
  "Không thể lấy assertion hợp lệ. Hãy kiểm tra endpoint rồi thử lại.";
// shortcut: 8 KiB leaves room for a 6 KiB assertion plus JSON; raise if v1 grows.
const MAX_ENDPOINT_RESPONSE_BYTES = 8 * 1024;

const SAFE_ERROR_RESPONSES: Record<
  string,
  { status: number; message: string }
> = {
  RATE_LIMITED: {
    status: 429,
    message: "Endpoint đang giới hạn số yêu cầu. Vui lòng đợi rồi thử lại.",
  },
  TEST_USER_UNAVAILABLE: {
    status: 503,
    message:
      "Người dùng demo chưa sẵn sàng. Hãy liên hệ quản trị viên tổ chức.",
  },
  ISSUER_ERROR: {
    status: 502,
    message:
      "Máy chủ cấp assertion gặp lỗi. Hãy thử lại sau hoặc liên hệ quản trị viên.",
  },
};

export class DemoAssertionEndpointError extends Error {
  constructor(message = GENERIC_FAILURE) {
    super(message);
    this.name = "DemoAssertionEndpointError";
  }
}

export function isDemoAssertionEndpointUrl(value: string) {
  const authority = /^https:\/\/([^/?#]+)/i.exec(value)?.[1];
  if (
    !authority ||
    authority.includes("@") ||
    value !== value.trim() ||
    value.includes("\\") ||
    value.includes("?") ||
    value.includes("#")
  )
    return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname !== "" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return null;
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function decodeJwtJson(value: string): unknown {
  const bytes = decodeBase64Url(value);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}

function expirySeconds(expiresAt: string) {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z$/.exec(
    expiresAt
  );
  if (!match || (match[2] && /[1-9]/.test(match[2]))) return null;
  const milliseconds = Date.parse(expiresAt);
  if (!Number.isFinite(milliseconds)) return null;
  try {
    return new Date(milliseconds).toISOString() === `${match[1]}.000Z`
      ? milliseconds / 1000
      : null;
  } catch {
    return null;
  }
}

function hasValidExpiry(assertion: string, expiresAt: string) {
  const parts = assertion.split(".");
  if (parts.length !== 3) return false;
  const header = decodeJwtJson(parts[0]);
  const claims = decodeJwtJson(parts[1]);
  if (!isRecord(header) || typeof header.alg !== "string" || !isRecord(claims))
    return false;
  if (!decodeBase64Url(parts[2])) return false;

  const exp = claims.exp;
  const responseExpiry = expirySeconds(expiresAt);
  return (
    typeof exp === "number" &&
    Number.isSafeInteger(exp) &&
    Number.isSafeInteger(exp * 1000) &&
    responseExpiry === exp &&
    exp * 1000 > Date.now()
  );
}

function errorFromResponse(response: Response, payload: unknown) {
  const code =
    isRecord(payload) &&
    isRecord(payload.error) &&
    typeof payload.error.code === "string"
      ? payload.error.code
      : "";
  const knownError = SAFE_ERROR_RESPONSES[code];
  return new DemoAssertionEndpointError(
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ===
      "application/json" && knownError?.status === response.status
      ? knownError.message
      : GENERIC_FAILURE
  );
}

function hasNoStore(response: Response) {
  return response.headers
    .get("cache-control")
    ?.split(",")
    .some((directive) => directive.trim().toLowerCase() === "no-store");
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_ENDPOINT_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}

export async function fetchDemoAssertion(
  endpoint: string,
  signal?: AbortSignal
): Promise<{ assertion: string; expiresAt: number }> {
  if (!isDemoAssertionEndpointUrl(endpoint))
    throw new DemoAssertionEndpointError();

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "omit",
      mode: "cors",
      redirect: "error",
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new DemoAssertionEndpointError();
  }

  let payload: unknown;
  try {
    payload = await readJson(response);
  } catch {
    throw new DemoAssertionEndpointError();
  }

  if (!response.ok) throw errorFromResponse(response, payload);
  if (
    !hasNoStore(response) ||
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
      "application/json" ||
    !isRecord(payload) ||
    typeof payload.assertion !== "string" ||
    !isDemoUserIdentity(payload.assertion) ||
    new TextEncoder().encode(payload.assertion).byteLength >
      MAX_SIGNED_USER_ASSERTION_BYTES ||
    typeof payload.expires_at !== "string" ||
    !hasValidExpiry(payload.assertion, payload.expires_at)
  ) {
    throw new DemoAssertionEndpointError();
  }

  return {
    assertion: payload.assertion,
    expiresAt: Date.parse(payload.expires_at),
  };
}
