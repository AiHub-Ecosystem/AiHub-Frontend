import type { OrganizationMembership } from "@/lib/organizations";

export const DEMO_ACCOUNT_EMAIL = "demo@aihub.vn";
export const DEMO_ACCOUNT_PASSWORD = "AiHubDemo2026!";
export const DEMO_SESSION_TOKEN =
  "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

export function isDemoCredentials(email: string, password: string) {
  return (
    email.trim().toLowerCase() === DEMO_ACCOUNT_EMAIL &&
    password === DEMO_ACCOUNT_PASSWORD
  );
}

export function isDemoSessionToken(token: string | null | undefined) {
  return token === DEMO_SESSION_TOKEN;
}

export const DEMO_ORGANIZATION_ROSTER: OrganizationMembership[] = [
  {
    id: "org_demo_wispace",
    name: "Wispace EdTech",
    status: "active",
    membershipRole: "owner",
    entitlements: ["exam_gen", "grade", "exercise", "exam_room", "weakness"],
    identityConfigured: false,
  },
];
