import { defineConfig } from "@playwright/test";

const appUrl = "http://127.0.0.1:3100";
const secondAppUrl = "http://127.0.0.1:3105";
const mockUrl = "http://127.0.0.1:3101";
const speakingEnv = {
  AIHUB_SANDBOX_BASE_URL: mockUrl,
  AIHUB_SANDBOX_E2E_MOCK_BASE_URL: mockUrl,
  AIHUB_SANDBOX_API_KEY: "aihub_sk_e2e_sandbox_key",
  AIHUB_SANDBOX_ORGANIZATION_ID: "org-e2e-00000000",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // ponytail: mock state is global; add per-worker mock instances before raising workers.
  workers: 1,
  reporter: "list",
  use: {
    baseURL: appUrl,
    browserName: "chromium",
  },
  webServer: [
    {
      name: "AIHUB mock",
      command: "node tests/e2e/mock-aihub-server.mjs",
      url: `${mockUrl}/health`,
      reuseExistingServer: false,
      timeout: 15_000,
    },
    {
      name: "Next.js app",
      command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
      url: appUrl,
      env: {
        API_BASE_URL: mockUrl,
        AIHUB_BASE_URL: mockUrl,
        CUSTOMER_WEB_ORIGIN: appUrl,
        AIHUB_WEB_SESSION_CLIENT_SECRET: "e2e-web-session-secret",
        E2E_TESTING: "1",
        NEXT_TELEMETRY_DISABLED: "1",
        ...speakingEnv,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      name: "Second Next.js app instance",
      command: "npm run dev -- --hostname 127.0.0.1 --port 3105",
      url: secondAppUrl,
      env: {
        API_BASE_URL: mockUrl,
        AIHUB_BASE_URL: mockUrl,
        CUSTOMER_WEB_ORIGIN: appUrl,
        AIHUB_WEB_SESSION_CLIENT_SECRET: "e2e-web-session-secret",
        NEXT_DIST_DIR: ".next-e2e-secondary",
        NEXT_TELEMETRY_DISABLED: "1",
        ...speakingEnv,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
