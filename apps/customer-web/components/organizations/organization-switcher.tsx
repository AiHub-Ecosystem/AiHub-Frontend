"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  membershipRoleLabel,
  organizationDestination,
  organizationStatusLabel,
  shortOrganizationId,
  type OrganizationMembership,
} from "@/lib/organizations";

/** An Owner of an active Organization is the usual case, so it goes unsaid. */
function membershipNote(organization: OrganizationMembership) {
  const notes = [
    organization.membershipRole !== "owner" &&
      membershipRoleLabel(organization.membershipRole),
    organization.status !== "active" &&
      organizationStatusLabel(organization.status),
  ].filter(Boolean);
  return notes.join(" · ");
}

/** A menu in the Organization header for jumping to another Organization. */
export function OrganizationSwitcher({
  roster,
  selectedId,
}: {
  roster: OrganizationMembership[];
  selectedId: string;
}) {
  const menu = useRef<HTMLDetailsElement>(null);

  // A native <details> stays open until toggled; close it like a menu.
  useEffect(() => {
    function close(event: Event) {
      const details = menu.current;
      if (!details?.open) return;
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !details.contains(event.target as Node)
      ) {
        details.open = false;
        if (event instanceof KeyboardEvent)
          details.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

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
    <details className="org-switcher" ref={menu}>
      <summary>Chuyển Organization</summary>
      <nav aria-label="Organizations" className="org-switcher-menu">
        <ul>
          {roster.map((organization) => {
            const note = membershipNote(organization);
            return (
              <li key={organization.id}>
                <Link
                  aria-current={
                    organization.id === selectedId ? "page" : undefined
                  }
                  href={organizationDestination(organization)}
                >
                  <span className="org-switcher-name">
                    {organization.name}
                    {duplicateNames.has(organization.id) && (
                      <span className="org-switcher-note">
                        {" "}
                        {shortOrganizationId(organization.id)}
                      </span>
                    )}
                  </span>
                  {note && <span className="org-switcher-note">{note}</span>}
                  {organization.id === selectedId && (
                    <span aria-hidden="true" className="org-switcher-check">
                      ✓
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link className="org-switcher-all" href="/console/orgs">
          Tất cả Organizations →
        </Link>
      </nav>
    </details>
  );
}
