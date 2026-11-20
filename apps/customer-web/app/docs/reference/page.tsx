import type { Metadata } from "next";
import { requirePageWebSession } from "@/lib/page-session";
import { ReferenceBody } from "@/components/docs/reference-body";
import "../../aihub.css";
import "../../auth.css";

export const metadata: Metadata = { title: "API Reference — AIHub" };
export const dynamic = "force-dynamic";

export default async function DocsReferencePage() {
  await requirePageWebSession("/docs/reference");
  return <ReferenceBody />;
}
