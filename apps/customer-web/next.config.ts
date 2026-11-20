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
  experimental: { agentUpgrade: "security" },
  basePath: "/app",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  ...(buildId ? { generateBuildId: async () => buildId } : {}),
  logging: {
    incomingRequests: {
      ignore: [/^\/verify-email(?:\?.*)?$/, /^\/reset-password(?:\?.*)?$/],
    },
  },
  async redirects() {
    return [
      // Legacy page URLs remain valid while traffic moves to the /app app.
      ...[
        "/about",
        "/blog/:path*",
        "/case-studies/:path*",
        "/community",
        "/connectors/:path*",
        "/console/:path*",
        "/contact",
        "/demo/:path*",
        "/docs/:path*",
        "/forgot-password",
        "/lab/:path*",
        "/login",
        "/meltano-vs-fivetran",
        "/podcasts/:path*",
        "/pricing",
        "/pricingcalculator",
        "/privacy-policy",
        "/product/:path*",
        "/register",
        "/reset-password",
        "/terms-of-service",
        "/test-harness/:path*",
        "/verify-email",
      ].map((source) => ({
        source,
        destination: `/app${source}`,
        basePath: false as const,
        permanent: true,
      })),
      {
        source: "/",
        destination: "/app",
        basePath: false as const,
        permanent: true,
      },
      // The retired Spec & cURL Hub; see docs/adr/0010-retire-specs-page.md.
      {
        source: "/specs",
        destination: "/app/product",
        basePath: false as const,
        permanent: true,
      },
    ];
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
