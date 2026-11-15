import type { NextConfig } from "next";

const appRoutes = [
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
  "/specs",
  "/terms-of-service",
];

const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return appRoutes.map((source) => ({
      source,
      destination: source === "/specs" ? "/app/product" : `/app${source}`,
      basePath: false,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
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

export default config;
