import {
  rejectedWebSessionCookie,
  webSessionClearHeaders,
} from "@/lib/auth-session";
import { dpopHandshakeResponse } from "@/lib/dpop-handshake";

export {
  AVATAR_CONTENT_TYPES,
  AVATAR_MAX_BYTES,
  AVATAR_STORAGE_ORIGIN,
  isAvatar,
  isAvatarAssetId,
} from "@/lib/avatar-contract";

export const noStore = { "Cache-Control": "no-store" };

export async function upstreamFailure(response: Response, fallback: string) {
  const dpopHandshake = await dpopHandshakeResponse(response);
  if (dpopHandshake) return dpopHandshake;
  let code = fallback;
  const clearCookie = rejectedWebSessionCookie(response);
  const body = await response.json().catch(() => null);
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
      headers: webSessionClearHeaders(noStore, !!clearCookie),
    }
  );
}

export function unavailable(code: string) {
  console.error("[account-avatar] request unavailable", { code });
  return Response.json({ error: { code } }, { status: 503, headers: noStore });
}
