import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePageWebSession } from "@/lib/page-session";
import { safeLocalPath } from "@/lib/auth-session";

export const metadata: Metadata = { title: "Console — AIHub" };
export const dynamic = "force-dynamic";

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  await requirePageWebSession("/console");

  const nextValue = (await searchParams).next;
  const next = safeLocalPath(
    typeof nextValue === "string" ? nextValue : null,
    ""
  );
  if (next && next !== "/console") redirect(next);
  redirect("/console/orgs");
}
