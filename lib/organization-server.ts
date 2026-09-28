import "server-only";
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

/** The Organization's key inventory through the BFF; null when unreadable. */
export async function readOrganizationApiKeys(
  sessionId: string,
  organizationId: string
): Promise<OrganizationApiKey[] | null> {
  try {
    const response = await fetch(
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
    if (!response.ok) return null;
    return parseOrganizationApiKeyList(await response.json());
  } catch {
    return null;
  }
}
