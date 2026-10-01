import { defineConfig } from "@playwright/test";
import {
  appPort,
  appUrl,
  distDir,
  mockPort,
  mockUrl,
  redisUrl,
  secondaryDistDir,
  secondAppPort,
  secondAppUrl,
} from "./tests/e2e/ports";

const speakingEnv = {
  AIHUB_SANDBOX_BASE_URL: mockUrl,
  AIHUB_SANDBOX_E2E_MOCK_BASE_URL: mockUrl,
  AIHUB_SANDBOX_API_KEY: "aihub_sk_e2e_sandbox_key",
  AIHUB_SANDBOX_ORGANIZATION_ID: "org-e2e-00000000",
};

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
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
      env: { E2E_MOCK_PORT: String(mockPort) },
      reuseExistingServer: false,
      timeout: 15_000,
    },
    {
      name: "Next.js app",
      command: `npm run dev -- --hostname 127.0.0.1 --port ${appPort}`,
      url: appUrl,
      env: {
        API_BASE_URL: mockUrl,
        AIHUB_BASE_URL: mockUrl,
        CUSTOMER_WEB_ORIGIN: appUrl,
        REDIS_URL: redisUrl,
        E2E_TESTING: "1",
        NEXT_DIST_DIR: distDir,
        NEXT_TELEMETRY_DISABLED: "1",
        ...speakingEnv,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      name: "Second Next.js app instance",
      command: `npm run dev -- --hostname 127.0.0.1 --port ${secondAppPort}`,
      url: secondAppUrl,
      env: {
        API_BASE_URL: mockUrl,
        AIHUB_BASE_URL: mockUrl,
        CUSTOMER_WEB_ORIGIN: appUrl,
        REDIS_URL: redisUrl,
        NEXT_DIST_DIR: secondaryDistDir,
        NEXT_TELEMETRY_DISABLED: "1",
        ...speakingEnv,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
