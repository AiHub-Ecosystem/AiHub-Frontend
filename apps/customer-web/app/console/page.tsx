import type { Metadata } from "next";
import { requirePageWebSession } from "@/lib/page-session";
import { safeLocalPath } from "@/lib/auth-session";
import { ConsoleRedirectBody } from "@/components/console/console-bodies";
import "../aihub.css";
import "../auth.css";

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
  return <ConsoleRedirectBody next={next} />;
}
