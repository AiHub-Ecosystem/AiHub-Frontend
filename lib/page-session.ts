import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentWebSession, WEB_SESSION_COOKIE } from "@/lib/auth-session";

export async function requirePageWebSession(next: string) {
  const sessionId = (await cookies()).get(WEB_SESSION_COOKIE)?.value;
  const encodedNext = encodeURIComponent(next);

  if (!sessionId) redirect(`/login?next=${encodedNext}`);
  let active: boolean;
  try {
    active = !!(await getCurrentWebSession(sessionId));
  } catch {
    redirect(`/login?error=unavailable&next=${encodedNext}`);
  }
  if (!active) redirect(`/login?error=session&next=${encodedNext}`);

  return sessionId;
}
