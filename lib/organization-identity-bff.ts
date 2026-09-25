import {
  containsPrivateJwk,
  identityValidationMessage,
  parseOrganizationIdentityConfig,
  parseOrganizationIdentityInput,
} from "@/lib/organization-identity";

export const identityNoStore = { "Cache-Control": "no-store" };
const knownReasons = new Set([
  "ORGANIZATION_IDENTITY_ISSUER_CONFLICT",
  "IDENTITY_JWKS_URL_UNSAFE",
  "IDENTITY_JWKS_SOURCE_UNAVAILABLE",
  "IDENTITY_JWKS_INVALID",
]);

export async function forwardIdentityResponse(upstream: Response) {
  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return Response.json(
      { error: { code: "IDENTITY_CONFIG_RESPONSE_INVALID" } },
      { status: 502, headers: identityNoStore }
    );
  }
  if (upstream.ok) {
    const config = parseOrganizationIdentityConfig(payload);
    return config
      ? Response.json(
          { data: config },
          { status: upstream.status, headers: identityNoStore }
        )
      : Response.json(
          { error: { code: "IDENTITY_CONFIG_RESPONSE_INVALID" } },
          { status: 502, headers: identityNoStore }
        );
  }
  const code = (payload as { error?: { code?: unknown } } | null)?.error?.code;
  return Response.json(
    {
      error: {
        code:
          typeof code === "string" && knownReasons.has(code)
            ? code
            : upstream.status === 403
              ? "FORBIDDEN"
              : "IDENTITY_CONFIG_REQUEST_FAILED",
      },
    },
    { status: upstream.status, headers: identityNoStore }
  );
}

export async function readIdentityInput(request: Request) {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 256 * 1024)
    return { error: "INVALID_REQUEST" as const };
  if (!request.body) return { error: "INVALID_REQUEST" as const };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256 * 1024) {
        await reader.cancel();
        return { error: "INVALID_REQUEST" as const };
      }
      chunks.push(value);
    }
  } catch {
    return { error: "INVALID_REQUEST" as const };
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return { error: "INVALID_REQUEST" as const };
  }
  if (
    containsPrivateJwk(
      (value as { public_keys_jwks?: unknown } | null)?.public_keys_jwks
    )
  )
    return { error: "PRIVATE_JWK_NOT_ALLOWED" as const };
  const input = parseOrganizationIdentityInput(value);
  return input ? { input } : { error: "INVALID_REQUEST" as const };
}

export function identityErrorMessage(code: string) {
  return code === "PRIVATE_JWK_NOT_ALLOWED"
    ? "Không gửi private JWK. Hãy xóa các trường private như d, p, q, dp, dq, qi, oth hoặc k."
    : identityValidationMessage(code);
}
