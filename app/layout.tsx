import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { HydrationMarker } from "@/components/hydration-marker";
import { AccountAvatarMenu } from "@/components/account-avatar-menu";
import { MirrorInteractions } from "@/components/mirror-interactions";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "./meltano-source.css";
import "./chrome-overrides.css";

// Both fonts were named throughout the stylesheets and loaded by nothing.
// `globals.css` and `demo-workbench.css` both resolve `--font-sans` and
// `--font-mono` through `--font-plus-jakarta` and `--font-plex-mono`, so every
// declaration fell through to `system-ui`. That looked fine on Windows, where
// `system-ui` is Segoe UI, and broke elsewhere: measured on the CI runner, a
// wider fallback pushed `score-label` and `criterion-badge` past their own
// boxes and failed the report clipping test twice.
//
// A page whose type changes with the operating system cannot have a layout
// measured once and trusted. Downloading and self-hosting the two faces the
// design already names makes every measurement portable.
//
// The variable is `--font-ibm-plex-mono`, not `--font-plex-mono`: Google Fonts
// has no Plex Mono, only IBM Plex Mono. The old name looked right, which is
// exactly why it went on pointing at nothing.
//
// `vietnamese` is not optional here. The interface is written in Vietnamese,
// and a subset without it renders every diacritic in a fallback face — the same
// split-the-look-across-platforms problem, one layer down.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext", "vietnamese"],
  display: "swap",
  variable: "--font-plus-jakarta",
});

// 400, 500 and 700 are the weights the demo asks for. It also asks for 800 in
// three places, which this family does not have; the browser takes 700 rather
// than synthesising a heavier face.
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "AIHub",
  description: "Marketplace và developer portal cho các API AI.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      className={`${plusJakartaSans.variable} ${ibmPlexMono.variable}`}
      lang="vi"
    >
      <head>
        <link rel="icon" type="image/png" href="/content/assets/favicon.png" />
      </head>
      <body>
        <MirrorInteractions />
        <SiteHeader />
        <AccountAvatarMenu />
        {children}
        <SiteFooter />
        <HydrationMarker />
      </body>
    </html>
  );
}
