import "server-only";
import { redirect } from "next/navigation";
import { customerWebOrigin, WEB_SESSION_COOKIE } from "@/lib/auth-session";
import {
  parseOrganizationApiKeyList,
  type OrganizationApiKey,
} from "@/lib/api-keys";
import {
  parseOrganizationRoster,
  type OrganizationMembership,
} from "@/lib/organizations";

export async function readOrganizationRoster(
  sessionId: string
): Promise<OrganizationMembership[] | null> {
  let response: Response;
  try {
    response = await fetch(
      new URL("/api/organizations/me/members", customerWebOrigin()),
      {
        headers: { Cookie: `${WEB_SESSION_COOKIE}=${sessionId}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      }
    );
  } catch {
    return null;
  }
  if (response.status === 401) redirect("/login?error=session");
  if (!response.ok) return null;
  try {
    return parseOrganizationRoster(await response.json());
  } catch {
    return null;
  }
}

/** The Organization's key inventory through the BFF; null when unreadable. */
export async function readOrganizationApiKeys(
  sessionId: string,
  organizationId: string
): Promise<OrganizationApiKey[] | null> {
  let response: Response;
  try {
    response = await fetch(
      new URL(
        `/api/organizations/${encodeURIComponent(organizationId)}/api-keys`,
        customerWebOrigin()
      ),
      {
        headers: { Cookie: `${WEB_SESSION_COOKIE}=${sessionId}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      }
    );
  } catch {
    return null;
  }
  if (response.status === 401) redirect("/login?error=session");
  if (!response.ok) return null;
  try {
    return parseOrganizationApiKeyList(await response.json());
  } catch {
    return null;
  }
}
