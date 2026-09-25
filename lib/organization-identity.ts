export type OrganizationIdentityConfig =
  | {
      configured: false;
    }
  | {
      configured: true;
      issuer: string;
      jwks_url: string | null;
      public_keys_jwks: { keys: Record<string, unknown>[] } | null;
      status: "active" | "disabled";
    };

export type OrganizationIdentityInput = {
  issuer: string;
  jwks_url?: string;
  public_keys_jwks?: { keys: Record<string, unknown>[] };
};

const privateJwkMembers = new Set([
  "d",
  "p",
  "q",
  "dp",
  "dq",
  "qi",
  "oth",
  "k",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function containsPrivateJwk(value: unknown): boolean {
  const row = record(value);
  if (!row) return false;
  if (Object.keys(row).some((key) => privateJwkMembers.has(key))) return true;
  return Array.isArray(row.keys) && row.keys.some(containsPrivateJwk);
}

export function parseOrganizationIdentityConfig(
  value: unknown
): OrganizationIdentityConfig | null {
  const data = record(record(value)?.data);
  if (data?.configured === false) return { configured: false };
  if (
    data?.configured !== true ||
    typeof data.issuer !== "string" ||
    !(data.jwks_url === null || typeof data.jwks_url === "string") ||
    !(data.public_keys_jwks === null || record(data.public_keys_jwks)) ||
    (data.status !== "active" && data.status !== "disabled")
  )
    return null;
  const publicKeys =
    data.public_keys_jwks === null ? null : record(data.public_keys_jwks);
  if (
    publicKeys &&
    (!Array.isArray(publicKeys.keys) ||
      publicKeys.keys.some((key) => !record(key)) ||
      containsPrivateJwk(publicKeys))
  )
    return null;
  return {
    configured: true,
    issuer: data.issuer,
    jwks_url: data.jwks_url as string | null,
    public_keys_jwks: publicKeys as { keys: Record<string, unknown>[] } | null,
    status: data.status,
  };
}

export function parseOrganizationIdentityInput(
  value: unknown
): OrganizationIdentityInput | null {
  const row = record(value);
  if (
    !row ||
    typeof row.issuer !== "string" ||
    row.issuer.trim().length < 1 ||
    row.issuer.length > 2048
  )
    return null;
  const hasUrl =
    typeof row.jwks_url === "string" && row.jwks_url.trim().length > 0;
  const hasInline = record(row.public_keys_jwks) !== null;
  if (hasUrl === hasInline) return null;
  if (hasInline) {
    const jwks = record(row.public_keys_jwks)!;
    if (
      !Array.isArray(jwks.keys) ||
      !jwks.keys.length ||
      jwks.keys.some((key) => !record(key))
    )
      return null;
    if (containsPrivateJwk(jwks)) return null;
    return {
      issuer: row.issuer.trim(),
      public_keys_jwks: jwks as { keys: Record<string, unknown>[] },
    };
  }
  return {
    issuer: row.issuer.trim(),
    jwks_url: (row.jwks_url as string).trim(),
  };
}

export function identityValidationMessage(code: string): string {
  switch (code) {
    case "ORGANIZATION_IDENTITY_ISSUER_CONFLICT":
      return "Issuer này đã được dùng bởi Organization khác. Hãy kiểm tra lại issuer.";
    case "IDENTITY_JWKS_URL_UNSAFE":
      return "JWKS URL không an toàn. Hãy dùng HTTPS trên host công khai mà Organization kiểm soát.";
    case "IDENTITY_JWKS_SOURCE_UNAVAILABLE":
      return "AIHUB không thể truy cập JWKS URL. Hãy kiểm tra endpoint và khả năng truy cập công khai.";
    case "IDENTITY_JWKS_INVALID":
      return "Public JWKS không hợp lệ hoặc không có key phù hợp. Hãy kiểm tra nội dung JSON.";
    default:
      return "Không thể lưu identity configuration. Hãy kiểm tra issuer và public JWKS rồi thử lại.";
  }
}
