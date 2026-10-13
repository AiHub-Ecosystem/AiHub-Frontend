import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  endUserIpFromHeaders,
  getCurrentWebSession,
  WEB_SESSION_COOKIE,
} from "@/lib/auth-session";

export async function requirePageWebSession(next: string) {
  const sessionId = (await cookies()).get(WEB_SESSION_COOKIE)?.value;
  const endUserIp = endUserIpFromHeaders(await headers());
  const encodedNext = encodeURIComponent(next);

  if (!sessionId) redirect(`/login?next=${encodedNext}`);
  let active: boolean;
  try {
    active = !!(await getCurrentWebSession(sessionId, endUserIp));
  } catch {
    redirect(`/login?error=unavailable&next=${encodedNext}`);
  }
  if (!active) redirect(`/login?error=session&next=${encodedNext}`);

  return sessionId;
}
