import { authenticatedAihubFetch } from "@/lib/auth-session";
import { requirePageWebSession } from "@/lib/page-session";

const VERSION = /^v[1-9][0-9]*$/u;

function referenceHtml(html: string) {
  const majors = [
    ...new Set(
      [...html.matchAll(/<option value="(v[1-9][0-9]*)"/gu)].map(
        (match) => match[1]
      )
    ),
  ];
  const downloads = [
    '<a href="/api/docs/openapi.json" download="openapi.json">Download latest OpenAPI JSON</a>',
    ...majors.map(
      (major) =>
        `<a href="/api/docs/openapi/${major}.json" download="openapi-${major}.json">Download OpenAPI ${major} JSON</a>`
    ),
  ].join("\n    ");

  return html
    .replace('action="/docs"', 'action="/docs/reference"')
    .replaceAll('data-url="/openapi/', 'data-url="/api/docs/openapi/')
    .replace(
      "</form>",
      `</form>\n  <nav aria-label="OpenAPI downloads">\n    ${downloads}\n  </nav>`
    );
}

export async function GET(request: Request) {
  const sessionId = await requirePageWebSession("/docs/reference");
  const version = new URL(request.url).searchParams.get("version");
  if (version !== null && !VERSION.test(version)) {
    return Response.json(
      { error: { code: "INVALID_VERSION" } },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const upstream = await authenticatedAihubFetch(
      request,
      sessionId,
      version === null ? "/docs" : `/docs?version=${version}`
    );
    if (!upstream.ok) return upstream;

    const html = referenceHtml(await upstream.text());
    const headers = new Headers(upstream.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.delete("transfer-encoding");
    headers.set("Cache-Control", "no-store");
    return new Response(html, { status: upstream.status, headers });
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
