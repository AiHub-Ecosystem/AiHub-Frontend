import type { NextConfig } from "next";

const buildId = process.env.NEXT_BUILD_ID;

// Every response. No page embeds itself in a frame, and the site is HTTPS-only
// behind nginx. A full Content-Security-Policy waits until the mirrored pages
// stop carrying inline markup it would have to allow.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  ...(buildId ? { generateBuildId: async () => buildId } : {}),
  logging: {
    incomingRequests: {
      ignore: [/^\/verify-email(?:\?.*)?$/, /^\/reset-password(?:\?.*)?$/],
    },
  },
  async redirects() {
    // The retired Spec & cURL Hub; see docs/adr/0010-retire-specs-page.md.
    return [{ source: "/specs", destination: "/product", permanent: true }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        source: "/verify-email",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/reset-password",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
