export type AuthError = {
  code?: unknown;
  fields?: unknown;
  retry_after_seconds?: unknown;
};

export function boundedRetry(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(3600, Math.max(1, Math.ceil(value)))
    : 60;
}
