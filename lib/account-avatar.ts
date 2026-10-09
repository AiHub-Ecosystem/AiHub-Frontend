import { rejectedWebSessionCookie } from "@/lib/auth-session";

export {
  AVATAR_CONTENT_TYPES,
  AVATAR_MAX_BYTES,
  AVATAR_STORAGE_ORIGIN,
  isAvatar,
} from "@/lib/avatar-contract";

export const noStore = { "Cache-Control": "no-store" };

export function upstreamFailure(response: Response, fallback: string) {
  let code = fallback;
  const clearCookie = rejectedWebSessionCookie(response);
  return response
    .json()
    .catch(() => null)
    .then((body: unknown) => {
      const candidate = (body as { error?: { code?: unknown } } | null)?.error
        ?.code;
      if (typeof candidate === "string" && /^[A-Z0-9_]{1,80}$/.test(candidate))
        code = candidate;
      console.error("[account-avatar] upstream request failed", {
        status: response.status,
        code,
      });
      return Response.json(
        { error: { code } },
        {
          status: response.status,
          headers: {
            ...noStore,
            ...(clearCookie ? { "Set-Cookie": clearCookie } : {}),
          },
        }
      );
    });
}

export function unavailable(code: string) {
  console.error("[account-avatar] request unavailable", { code });
  return Response.json({ error: { code } }, { status: 503, headers: noStore });
}
