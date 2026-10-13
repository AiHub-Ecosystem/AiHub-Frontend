/**
 * Every display prefix the backend issues a key under: one per Environment a new
 * key can be bound to, plus the shared prefix every key issued before that
 * carries. A prefix only helps a holder recognise a key; `allowed_environments`
 * is what authorizes it.
 */
export const API_KEY_RAW_PREFIXES = [
  "aihub_sandbox_",
  "aihub_prod_",
  "aihub_sk_",
] as const;

export const API_KEY_RAW_FORMAT = new RegExp(
  `^(?:${API_KEY_RAW_PREFIXES.join("|")})[A-Za-z0-9]{43}$`
);

export type ApiKeyStatus = "active" | "expired";

/** Every Environment the backend accepts on a customer API key. */
export const API_KEY_ENVIRONMENTS = [
  "production",
  "sandbox",
  "staging",
] as const;

export type ApiKeyEnvironment = (typeof API_KEY_ENVIRONMENTS)[number];

const API_KEY_ENVIRONMENT_LABELS: Record<ApiKeyEnvironment, string> = {
  production: "Production (tính phí)",
  sandbox: "Sandbox (miễn phí)",
  staging: "Staging",
};

/** Falls back to the raw value for an Environment the Console does not name. */
export function apiKeyEnvironmentLabel(environment: string): string {
  return (
    API_KEY_ENVIRONMENT_LABELS[environment as ApiKeyEnvironment] ?? environment
  );
}

/**
 * The only place the Sandbox allowance is written down. Static copy: the backend
 * exposes it through no endpoint, response body, or header, so a change there
 * leaves this stale and no test catches it. See ADR-0009 and aihub-be ADR-0056.
 */
export const SANDBOX_ORGANIZATION_MONTHLY_ALLOWANCE = 25;

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
    !API_KEY_RAW_FORMAT.test(data.api_key)
  )
    return null;
  return { ...key, api_key: data.api_key };
}
