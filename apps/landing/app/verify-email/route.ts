export function GET(request: Request) {
  const url = new URL(request.url);
  return new Response(null, {
    status: 308,
    headers: {
      Location: new URL(
        `/app/verify-email${url.search}`,
        url.origin
      ).toString(),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
