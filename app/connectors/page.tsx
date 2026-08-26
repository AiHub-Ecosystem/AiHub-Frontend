import type { Metadata } from "next";
import { MirrorPage } from "@/components/mirror-page";

export const metadata: Metadata = {
  title: "Connectors | AiHub",
};

export default function Page() { return <MirrorPage name="connectors" />; }
