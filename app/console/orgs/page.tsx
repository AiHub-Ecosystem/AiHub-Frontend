import type { Metadata } from "next";
import Link from "next/link";
import { requirePageWebSession } from "@/lib/page-session";
import { readOrganizationRoster } from "@/lib/organization-server";
import {
  organizationDestination,
  shortOrganizationId,
} from "@/lib/organizations";
import { SessionActivity } from "@/components/session-activity";
import { OrganizationCreationForm } from "@/components/organizations/organization-creation-form";
import { RosterUnavailable } from "@/components/organizations/roster-unavailable";
import "../../aihub.css";
import "../../auth.css";

export const metadata: Metadata = { title: "Organizations — AIHub" };
export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  const sessionId = await requirePageWebSession("/console/orgs");
  const roster = await readOrganizationRoster(sessionId);
  if (!roster) return <RosterUnavailable />;

  const duplicateNames = new Set(
    roster
      .filter((organization, index) =>
        roster.some(
          (other, otherIndex) =>
            index !== otherIndex &&
            other.name.trim().toLocaleLowerCase() ===
              organization.name.trim().toLocaleLowerCase()
        )
      )
      .map((organization) => organization.id)
  );

  return (
    <>
      <SessionActivity />
      <main className="aihub auth-page console-page">
        <div className="aihub-shell">
          <p className="aihub-eyebrow">AIHub Console</p>
          <div className="organization-directory-heading">
            <div>
              <h1 className="aihub-title">Organizations</h1>
              <p className="aihub-lede">
                Quản lý Organization và mở workspace bạn cần.
              </p>
            </div>
            <OrganizationCreationForm />
          </div>
          {roster.length ? (
            <ul aria-label="Organizations" className="organization-directory">
              {roster.map((organization) => (
                <li key={organization.id}>
                  <Link href={organizationDestination(organization)}>
                    <span className="organization-directory-name">
                      {organization.name}
                      {duplicateNames.has(organization.id) && (
                        <span className="aihub-secondary">
                          {shortOrganizationId(organization.id)}
                        </span>
                      )}
                    </span>
                    <span className="organization-directory-meta">
                      <span>{organization.membershipRole}</span>
                      <span>{organization.status}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="organization-directory-arrow"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="organization-directory-empty">
              Bạn chưa tham gia Organization nào. Tạo Organization để bắt đầu.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
