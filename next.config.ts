import type { NextConfig } from "next";

const buildId = process.env.NEXT_BUILD_ID;

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
