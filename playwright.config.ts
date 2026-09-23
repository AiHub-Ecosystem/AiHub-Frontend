import { defineConfig } from "@playwright/test";

const appUrl = "http://127.0.0.1:3100";
const mockUrl = "http://127.0.0.1:3101";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
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
        NEXT_TELEMETRY_DISABLED: "1",
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
