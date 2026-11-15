import { redirect } from "next/navigation";
import { requirePageWebSession } from "@/lib/page-session";

export const dynamic = "force-dynamic";

export default async function NewOrganizationPage() {
  await requirePageWebSession("/console/orgs/new");
  redirect("/console/orgs");
}
