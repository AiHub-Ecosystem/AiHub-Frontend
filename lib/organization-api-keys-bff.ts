import { API_KEY_SCOPE_CATALOG } from "@/lib/api-key-scopes";
import { validatedOrganizationName } from "@/lib/organizations";

export const apiKeyNoStore = { "Cache-Control": "no-store" };

const apiKeyScopes = new Set<string>(
  API_KEY_SCOPE_CATALOG.map((item) => item.scope)
);
const apiKeyEnvironments = new Set<string>([
  "production",
  "sandbox",
  "staging",
]);
const maxCreateBodyBytes = 16 * 1024;
const maxApiKeyResponseBytes = 256 * 1024;

export function validOrganizationId(value: string) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function validApiKeyId(value: string) {
  return /^ak_[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
}

export type CreateApiKeyInput = {
  name: string;
  scopes: string[];
  allowed_environments: string[];
  expires_at?: string;
};

async function readBoundedBytes(
  stream: ReadableStream<Uint8Array> | null,
  contentLengthHeader: string | null,
  limit: number
) {
  const contentLength = Number(contentLengthHeader);
  if (Number.isFinite(contentLength) && contentLength > limit) return null;
  if (!stream) return new Uint8Array();

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readCreateApiKeyBody(request: Request): Promise<unknown> {
  const bytes = await readBoundedBytes(
    request.body,
    request.headers.get("content-length"),
    maxCreateBodyBytes
  );
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}

export function parseCreateApiKeyInput(
  value: unknown
): CreateApiKeyInput | null {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return null;
  const body = value as Record<string, unknown>;
  const name = validatedOrganizationName(body.name);
  if (
    !name ||
    !Array.isArray(body.scopes) ||
    body.scopes.length === 0 ||
    body.scopes.length > API_KEY_SCOPE_CATALOG.length ||
    new Set(body.scopes).size !== body.scopes.length ||
    body.scopes.some(
      (scope) => typeof scope !== "string" || !apiKeyScopes.has(scope)
    ) ||
    !Array.isArray(body.allowed_environments) ||
    body.allowed_environments.length === 0 ||
    body.allowed_environments.length > apiKeyEnvironments.size ||
    new Set(body.allowed_environments).size !==
      body.allowed_environments.length ||
    body.allowed_environments.some(
      (environment) =>
        typeof environment !== "string" || !apiKeyEnvironments.has(environment)
    )
  )
    return null;

  if (body.expires_at !== undefined && body.expires_at !== null) {
    if (
      typeof body.expires_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        body.expires_at
      ) ||
      !Number.isFinite(Date.parse(body.expires_at))
    )
      return null;
  }

  return {
    name,
    scopes: body.scopes as string[],
    allowed_environments: body.allowed_environments as string[],
    ...(typeof body.expires_at === "string"
      ? { expires_at: body.expires_at }
      : {}),
  };
}

function errorCode(status: number, responseText: string) {
  let upstreamCode: unknown;
  try {
    upstreamCode = (JSON.parse(responseText) as { error?: { code?: unknown } })
      .error?.code;
  } catch {
    upstreamCode = undefined;
  }

  if (
    upstreamCode === "API_KEY_LIMIT_REACHED" ||
    upstreamCode === "API_KEY_SCOPE_NOT_ENTITLED"
  )
    return upstreamCode;
  if (status === 401) return "AUTH_REQUIRED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 400) return "INVALID_REQUEST";
  return "API_KEY_REQUEST_FAILED";
}

export async function forwardApiKeyResponse(
  upstream: Response,
  mapSuccess?: (payload: unknown) => unknown
) {
  const bytes = await readBoundedBytes(
    upstream.body,
    upstream.headers.get("content-length"),
    maxApiKeyResponseBytes
  );
  if (!bytes) {
    console.error("[api-keys] upstream response exceeded the size limit");
    return Response.json(
      { error: { code: "API_KEY_RESPONSE_INVALID" } },
      { status: 502, headers: apiKeyNoStore }
    );
  }
  const responseText = new TextDecoder().decode(bytes);
  if (!upstream.ok) {
    const code = errorCode(upstream.status, responseText);
    console.warn("[api-keys] upstream request failed", {
      status: upstream.status,
      code,
    });
    return Response.json(
      { error: { code } },
      { status: upstream.status, headers: apiKeyNoStore }
    );
  }
  if (upstream.status === 204)
    return new Response(null, { status: 204, headers: apiKeyNoStore });

  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
  } catch {
    console.error("[api-keys] upstream returned invalid JSON");
    return Response.json(
      { error: { code: "API_KEY_RESPONSE_INVALID" } },
      { status: 502, headers: apiKeyNoStore }
    );
  }
  const mappedPayload = mapSuccess ? mapSuccess(payload) : payload;
  if (mappedPayload === null) {
    console.error("[api-keys] upstream response failed schema validation");
    return Response.json(
      { error: { code: "API_KEY_RESPONSE_INVALID" } },
      { status: 502, headers: apiKeyNoStore }
    );
  }
  if (mappedPayload === undefined)
    return new Response(null, {
      status: upstream.status,
      headers: apiKeyNoStore,
    });
  return Response.json(mappedPayload, {
    status: upstream.status,
    headers: apiKeyNoStore,
  });
}

export function apiKeyRequestUnavailable(code: string) {
  console.error("[api-keys] upstream request unavailable", { code });
  return Response.json(
    { error: { code } },
    { status: 503, headers: apiKeyNoStore }
  );
}
