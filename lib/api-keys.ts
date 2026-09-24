export type ApiKeyStatus = "active" | "expired";

export type OrganizationApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  allowed_environments: string[];
  status: ApiKeyStatus;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

export type MintedOrganizationApiKey = OrganizationApiKey & {
  api_key: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isDateOrNull(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" && Number.isFinite(Date.parse(value)))
  );
}

export function parseOrganizationApiKey(
  value: unknown
): OrganizationApiKey | null {
  const row = record(value);
  if (
    !row ||
    typeof row.id !== "string" ||
    !/^ak_[0-9A-HJKMNP-TV-Z]{26}$/.test(row.id) ||
    typeof row.name !== "string" ||
    typeof row.key_prefix !== "string" ||
    !Array.isArray(row.scopes) ||
    row.scopes.some((scope) => typeof scope !== "string") ||
    !Array.isArray(row.allowed_environments) ||
    row.allowed_environments.some(
      (environment) => typeof environment !== "string"
    ) ||
    (row.status !== "active" && row.status !== "expired") ||
    !isDateOrNull(row.expires_at) ||
    !isDateOrNull(row.last_used_at) ||
    typeof row.created_at !== "string" ||
    !Number.isFinite(Date.parse(row.created_at))
  )
    return null;
  return {
    id: row.id,
    name: row.name,
    key_prefix: row.key_prefix,
    scopes: row.scopes as string[],
    allowed_environments: row.allowed_environments as string[],
    status: row.status,
    expires_at: row.expires_at,
    last_used_at: row.last_used_at,
    created_at: row.created_at,
  };
}

export function parseOrganizationApiKeyList(value: unknown) {
  const root = record(value);
  const data = record(root?.data);
  if (!Array.isArray(data?.api_keys)) return null;
  const keys = data.api_keys.map(parseOrganizationApiKey);
  return keys.every((key) => key !== null)
    ? (keys as OrganizationApiKey[])
    : null;
}

export function parseMintedOrganizationApiKey(
  value: unknown
): MintedOrganizationApiKey | null {
  const root = record(value);
  const data = record(root?.data);
  const key = parseOrganizationApiKey(data);
  if (
    !key ||
    typeof data?.api_key !== "string" ||
    !/^aihub_sk_[A-Za-z0-9]{43}$/.test(data.api_key)
  )
    return null;
  return { ...key, api_key: data.api_key };
}
