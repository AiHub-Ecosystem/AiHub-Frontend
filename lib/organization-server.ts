import "server-only";
import { customerWebOrigin, WEB_SESSION_COOKIE } from "@/lib/auth-session";
import {
  parseOrganizationRoster,
  type OrganizationMembership,
} from "@/lib/organizations";

export async function readOrganizationRoster(
  sessionId: string
): Promise<OrganizationMembership[] | null> {
  try {
    const response = await fetch(
      new URL("/api/organizations/me/members", customerWebOrigin()),
      {
        headers: { Cookie: `${WEB_SESSION_COOKIE}=${sessionId}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (!response.ok) return null;
    return parseOrganizationRoster(await response.json());
  } catch {
    return null;
  }
}
