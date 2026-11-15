import {
  authenticatedAihubFetch,
  requireWebSession,
  webSessionIdFromRequest,
} from "@/lib/auth-session";

const VERSIONED_DOCUMENT = /^v[1-9][0-9]*\.json$/u;
const noStore = { "Cache-Control": "no-store" };

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  let upstreamPath: string;
  let filename: string;
  if (path.length === 1 && path[0] === "openapi.json") {
    upstreamPath = "/openapi.json";
    filename = "openapi.json";
  } else if (
    path.length === 2 &&
    path[0] === "openapi" &&
    path[1] !== undefined &&
    VERSIONED_DOCUMENT.test(path[1])
  ) {
    upstreamPath = `/openapi/${path[1]}`;
    filename = `openapi-${path[1]}`;
  } else {
    return new Response(null, { status: 404, headers: noStore });
  }

  const denied = await requireWebSession(request);
  if (denied) return denied;
  const sessionId = webSessionIdFromRequest(request)!;

  try {
    const upstream = await authenticatedAihubFetch(
      request,
      sessionId,
      upstreamPath
    );
    if (!upstream.ok) return upstream;

    const headers = new Headers(upstream.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return new Response(null, { status: 503, headers: noStore });
  }
}
