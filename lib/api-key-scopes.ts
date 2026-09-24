export const API_KEY_SCOPE_CATALOG = [
  { entitlement: "writing", scope: "writing.grade", service: "Writing" },
  { entitlement: "speaking", scope: "speaking.grade", service: "Speaking" },
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPE_CATALOG)[number]["scope"];

export function apiKeyScopeOptions(entitlements: readonly string[]) {
  const granted = new Set(entitlements);
  return API_KEY_SCOPE_CATALOG.map((option) => ({
    ...option,
    available: granted.has(option.entitlement),
  }));
}
