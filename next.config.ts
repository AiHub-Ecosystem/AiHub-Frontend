import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  logging: {
    incomingRequests: {
      ignore: [/^\/verify-email(?:\?.*)?$/, /^\/reset-password(?:\?.*)?$/],
    },
  },
  async redirects() {
    // The retired Spec & cURL Hub; the API product catalog and its API references are the only public API docs.
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
