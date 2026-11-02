export const API_KEY_SCOPE_CATALOG = [
  {
    entitlement: "writing",
    scope: "writing.grade",
    service: "Writing",
    label: "Chấm bài viết",
  },
  {
    entitlement: "writing",
    scope: "writing.exercise",
    service: "Writing",
    label: "Bài tập Writing",
  },
  {
    entitlement: "speaking",
    scope: "speaking.grade",
    service: "Speaking",
    label: "Chấm bài nói",
  },
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPE_CATALOG)[number]["scope"];

export function apiKeyScopeOptions(entitlements: readonly string[]) {
  const granted = new Set(entitlements);
  return API_KEY_SCOPE_CATALOG.map((option) => ({
    ...option,
    available: granted.has(option.entitlement),
  }));
}
