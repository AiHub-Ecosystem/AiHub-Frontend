import { aihubUrl } from "@/lib/auth-session";

export const AUTH_NO_STORE = { "Cache-Control": "no-store" };

export async function postAihubAuth(path: string, body: unknown) {
  try {
    return await fetch(aihubUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return null;
  }
}

export async function readAihubAuthError(response: Response) {
  let error: { code?: unknown; retry_after_ms?: unknown } = {};
  try {
    const body = (await response.json()) as {
      error?: { code?: unknown; retry_after_ms?: unknown };
    };
    error = body.error ?? {};
  } catch {
    // Malformed upstream errors are handled as generic temporary failures.
  }

  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfterMs = error.retry_after_ms;
  const parsedHeaderValue = retryAfterHeader
    ? /^\d+$/.test(retryAfterHeader)
      ? Number(retryAfterHeader)
      : Math.ceil((Date.parse(retryAfterHeader) - Date.now()) / 1000)
    : undefined;
  const parsedHeader =
    parsedHeaderValue !== undefined && Number.isFinite(parsedHeaderValue)
      ? parsedHeaderValue
      : undefined;
  const parsedBody =
    typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs)
      ? Math.ceil(retryAfterMs / 1000)
      : undefined;
  const retryAfterSeconds = Math.min(
    3600,
    Math.max(1, parsedHeader ?? parsedBody ?? 60)
  );

  return {
    code: typeof error.code === "string" ? error.code : null,
    retryAfterSeconds,
  };
}
