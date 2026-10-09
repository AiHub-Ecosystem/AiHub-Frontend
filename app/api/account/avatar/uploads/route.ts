import {
  authenticatedAihubFetch,
  originIsAllowed,
  requireWebSession,
  webSessionIdFromRequest,
} from "@/lib/auth-session";
import {
  AVATAR_CONTENT_TYPES,
  AVATAR_MAX_BYTES,
  AVATAR_STORAGE_ORIGIN,
  noStore,
  unavailable,
  upstreamFailure,
} from "@/lib/account-avatar";

const MAX_METADATA_BODY_BYTES = 1024;

async function readMetadata(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    return null;
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_METADATA_BODY_BYTES)
    return null;
  const reader = request.body?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_METADATA_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!originIsAllowed(request))
    return new Response(null, { status: 403, headers: noStore });
  const denied = await requireWebSession(request);
  if (denied) return denied;

  const body = await readMetadata(request);
  if (!body || typeof body !== "object" || Array.isArray(body))
    return Response.json(
      { error: { code: "INVALID_AVATAR_UPLOAD" } },
      { status: 400, headers: noStore }
    );
  const metadata = body as Record<string, unknown>;
  if (
    Object.keys(metadata).length !== 2 ||
    !Object.hasOwn(metadata, "content_type") ||
    !Object.hasOwn(metadata, "byte_size")
  )
    return Response.json(
      { error: { code: "INVALID_AVATAR_UPLOAD" } },
      { status: 400, headers: noStore }
    );
  const { content_type: contentType, byte_size: byteSize } = metadata as {
    content_type?: unknown;
    byte_size?: unknown;
  };
  if (
    typeof contentType !== "string" ||
    !AVATAR_CONTENT_TYPES.includes(
      contentType as (typeof AVATAR_CONTENT_TYPES)[number]
    ) ||
    typeof byteSize !== "number" ||
    !Number.isInteger(byteSize) ||
    byteSize < 1 ||
    byteSize > AVATAR_MAX_BYTES
  ) {
    return Response.json(
      { error: { code: "INVALID_AVATAR_UPLOAD" } },
      { status: 400, headers: noStore }
    );
  }

  try {
    const upstream = await authenticatedAihubFetch(
      webSessionIdFromRequest(request)!,
      "/v1/me/avatar/uploads",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_type: contentType,
          byte_size: byteSize,
        }),
      }
    );
    if (!upstream.ok)
      return upstreamFailure(upstream, "AVATAR_UPLOAD_UNAVAILABLE");
    const payload = (await upstream.json()) as {
      data?: {
        asset_id?: unknown;
        upload_url?: unknown;
        method?: unknown;
        headers?: unknown;
        expires_at?: unknown;
      };
    };
    const grant = payload.data;
    let uploadUrl: URL | null = null;
    try {
      uploadUrl = new URL(String(grant?.upload_url));
    } catch {}
    if (
      !grant ||
      typeof grant.asset_id !== "string" ||
      !/^ava_[0-9A-HJKMNP-TV-Z]{26}$/.test(grant.asset_id) ||
      !uploadUrl ||
      uploadUrl.origin !== AVATAR_STORAGE_ORIGIN ||
      uploadUrl.username !== "" ||
      uploadUrl.password !== "" ||
      grant.method !== "PUT" ||
      !grant.headers ||
      typeof grant.headers !== "object" ||
      typeof grant.expires_at !== "string"
    ) {
      return unavailable("AVATAR_UPLOAD_RESPONSE_INVALID");
    }
    const headers = grant.headers as Record<string, unknown>;
    if (
      headers["Content-Type"] !== contentType ||
      headers["Content-Length"] !== String(byteSize) ||
      headers["Cache-Control"] !== "public, max-age=3600" ||
      Object.entries(headers).some(
        ([name, value]) =>
          !/^[A-Za-z0-9-]+$/.test(name) || typeof value !== "string"
      )
    ) {
      return unavailable("AVATAR_UPLOAD_RESPONSE_INVALID");
    }
    return Response.json(
      { data: grant },
      { status: upstream.status, headers: noStore }
    );
  } catch {
    return unavailable("AVATAR_UPLOAD_UNAVAILABLE");
  }
}
