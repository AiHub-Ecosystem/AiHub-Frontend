import type { Metadata } from "next";
import { requirePageWebSession } from "@/lib/page-session";
import { OrgsBody } from "@/components/console/console-bodies";
import "../../aihub.css";
import "../../auth.css";

export const metadata: Metadata = { title: "Organizations — AIHub" };
export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  await requirePageWebSession("/console/orgs");
  return <OrgsBody />;
}
