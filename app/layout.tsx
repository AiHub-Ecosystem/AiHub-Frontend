import type { Metadata } from "next";
import { HydrationMarker } from "@/components/hydration-marker";
import { MirrorInteractions } from "@/components/mirror-interactions";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "./meltano-source.css";
import "./chrome-overrides.css";

export const metadata: Metadata = {
  title: "AIHub",
  description: "Marketplace và developer portal cho các API AI.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        <link rel="icon" type="image/png" href="/content/assets/favicon.png" />
      </head>
      <body>
        <MirrorInteractions />
        <SiteHeader />
        {children}
        <SiteFooter />
        <HydrationMarker />
      </body>
    </html>
  );
}
