import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  clientProofKeyFromHeaders,
  endUserIpFromHeaders,
  getCurrentWebSession,
  WEB_SESSION_COOKIE,
} from "@/lib/auth-session";

export async function requirePageWebSession(next: string) {
  const sessionId = (await cookies()).get(WEB_SESSION_COOKIE)?.value;
  const requestHeaders = await headers();
  const endUserIp = endUserIpFromHeaders(requestHeaders);
  const proofKey = clientProofKeyFromHeaders(requestHeaders);
  const encodedNext = encodeURIComponent(`/app${next}`);

  if (!sessionId) redirect(`/login?next=${encodedNext}`);
  let active: boolean;
  try {
    active = !!(await getCurrentWebSession(sessionId, endUserIp, proofKey));
  } catch {
    redirect(`/login?error=unavailable&next=${encodedNext}`);
  }
  if (!active) redirect(`/login?error=session&next=${encodedNext}`);

  return sessionId;
}
