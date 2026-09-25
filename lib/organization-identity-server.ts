import "server-only";
import { authenticatedAihubFetch } from "@/lib/auth-session";
import {
  parseOrganizationIdentityConfig,
  type OrganizationIdentityConfig,
} from "@/lib/organization-identity";

export async function readOrganizationIdentityConfig(
  sessionId: string,
  organizationId: string
): Promise<{
  config: OrganizationIdentityConfig | null;
  forbidden: boolean;
  unavailable: boolean;
}> {
  try {
    const response = await authenticatedAihubFetch(
      sessionId,
      `/v1/organizations/${encodeURIComponent(organizationId)}/identity-config`
    );
    if (response.status === 403)
      return { config: null, forbidden: true, unavailable: false };
    if (!response.ok)
      return { config: null, forbidden: false, unavailable: true };
    const config = parseOrganizationIdentityConfig(await response.json());
    return { config, forbidden: false, unavailable: !config };
  } catch {
    return { config: null, forbidden: false, unavailable: true };
  }
}
