import {
  completeOrganizationCreation,
  originIsAllowed,
  requireWebSession,
  webSessionIdFromRequest,
} from "@/lib/auth-session";

export async function POST(request: Request) {
  if (!originIsAllowed(request)) return new Response(null, { status: 403 });
  const denied = await requireWebSession(request);
  if (denied) return denied;
  await completeOrganizationCreation(webSessionIdFromRequest(request)!);
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
