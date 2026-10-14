import { expect, test, type Page } from "@playwright/test";
import { waitForHydration } from "./hydration";

const mockUrl = "http://127.0.0.1:3101";
const password = "correct horse battery staple";
const demoKey = "aihub_sandbox_" + "A".repeat(43);
const sandboxKey = "aihub_sk_e2e_sandbox_key";
const productionKey = "aihub_prod_e2e_production_key";

/** Every browser request to a demo BFF route, which Mock mode must never make. */
function countDemoApiCalls(page: Page) {
  const paths: string[] = [];
  page.on("request", (browserRequest) => {
    const path = new URL(browserRequest.url()).pathname;
    if (path.startsWith("/api/demo/")) paths.push(path);
  });
  return paths;
}

async function openDemo(page: Page, skill: "scoring" | "speaking") {
  await page.goto(`/demo/${skill}`);
  await waitForHydration(page);
  return page;
}

async function openGradingStep(page: Page) {
  await page
    .getByRole("button", { name: /Tiếp tục đến (bài làm|câu trả lời)/ })
    .click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();
}

test("Writing and Speaking default to Sandbox without an environment picker", async ({
  page,
}) => {
  await openDemo(page, "scoring");

  await expect(page.locator(".demo-env-picker")).toHaveCount(0);
  await expect(page.locator(".demo-flow-statuses .demo-mode-badge")).toHaveText(
    "Sandbox · Mẫu local"
  );
  await expect(
    page.getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kiểm tra API key" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Speaking", exact: true }).click();
  await waitForHydration(page);
  await expect(page.locator(".demo-env-picker")).toHaveCount(0);
  await expect(page.locator(".demo-flow-statuses .demo-mode-badge")).toHaveText(
    "Sandbox · Mẫu local"
  );
  await expect(
    page.getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kiểm tra API key" })
  ).toBeVisible();
});

test("Speaking detects a Production key and clears its acknowledgement on Sandbox change", async ({
  page,
}) => {
  await openDemo(page, "speaking");
  const apiKey = page.getByLabel("API key (Sandbox hoặc Production, tùy chọn)");
  const acknowledgement = page.getByTestId("production-acknowledgement");
  await expect(acknowledgement).toHaveCount(0);

  await apiKey.fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();
  await expect(page.getByTestId("production-key-warning")).toBeVisible();
  await acknowledgement.check();
  await expect(acknowledgement).toBeChecked();

  await apiKey.fill(demoKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();
  await expect(page.getByTestId("sandbox-allowance")).toBeVisible();
  await expect(acknowledgement).toHaveCount(0);
});

test("a Production key pasted into the default Sandbox flow is detected and warned", async ({
  page,
}) => {
  const validationEnvironments: string[] = [];
  page.on("request", (browserRequest) => {
    if (new URL(browserRequest.url()).pathname === "/api/demo/key/validate") {
      validationEnvironments.push(
        JSON.parse(browserRequest.postData() ?? "{}").environment
      );
    }
  });

  await openDemo(page, "scoring");
  await page
    .getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
    .fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();

  await expect(page.getByTestId("production-key-warning")).toContainText(
    "API key Production đã được xác thực"
  );
  await expect(
    page.getByTestId("production-acknowledgement")
  ).not.toBeChecked();
  expect(validationEnvironments).toEqual(["production"]);
});

test("a Production key pasted into Speaking is checked on Production", async ({
  page,
}) => {
  const validationEnvironments: string[] = [];
  page.on("request", (browserRequest) => {
    if (new URL(browserRequest.url()).pathname === "/api/demo/key/validate") {
      validationEnvironments.push(
        JSON.parse(browserRequest.postData() ?? "{}").environment
      );
    }
  });

  await openDemo(page, "speaking");
  await page
    .getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
    .fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();

  await expect(page.getByTestId("production-key-warning")).toBeVisible();
  await expect(
    page.getByTestId("production-acknowledgement")
  ).not.toBeChecked();
  expect(validationEnvironments).toEqual(["production"]);
});

test("a Production key opens live grading on the Production tier", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page
    .getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
    .fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();

  await expect(
    page.getByRole("heading", { name: "Chọn bài Writing" })
  ).toBeVisible();
  await openGradingStep(page);
  await page.getByRole("tab", { name: "Request" }).click();
  const requestTrace = page.locator(".demo-console .demo-console-code");
  await expect(requestTrace).toContainText("https://api.aihubproduction.com/");
  await expect(requestTrace).not.toContainText("bff_to_sandbox");
  await page.getByTestId("production-acknowledgement").check();
  await page.getByRole("button", { name: /Chấm thật Task 1/ }).click();

  await expect(page.getByTestId("scoring-report")).toBeVisible();
  await expect(page.getByText("LIVE RESPONSE").first()).toBeVisible();
});

test("the Production acknowledgement is locked while a grade is in flight", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page
    .getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
    .fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();
  await openGradingStep(page);
  await page.getByTestId("production-acknowledgement").check();

  let releaseGrade!: () => void;
  const gradeGate = new Promise<void>((resolve) => {
    releaseGrade = resolve;
  });
  await page.route("**/api/demo/scoring/grade", async (route) => {
    await gradeGate;
    await route.continue();
  });
  await page.getByRole("button", { name: /Chấm thật Task 1/ }).click();

  try {
    await expect(page.locator(".demo-env-picker")).toHaveCount(0);
    await expect(page.getByTestId("production-acknowledgement")).toBeDisabled();
  } finally {
    releaseGrade();
  }

  await expect(page.getByTestId("scoring-report")).toBeVisible();
  await expect(page.getByText("LIVE RESPONSE").first()).toBeVisible();
});

test("the shared key and environment stay locked across skills during grading", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page
    .getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
    .fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();
  await openGradingStep(page);
  await page.getByTestId("production-acknowledgement").check();

  let releaseGrade!: () => void;
  const gradeGate = new Promise<void>((resolve) => {
    releaseGrade = resolve;
  });
  await page.route("**/api/demo/scoring/grade", async (route) => {
    await gradeGate;
    await route.continue();
  });
  await page.getByRole("button", { name: /Chấm thật Task 1/ }).click();

  try {
    await expect(page.locator(".demo-env-picker")).toHaveCount(0);
    await page.getByRole("link", { name: "Speaking" }).click();
    await expect(page.locator(".demo-env-picker")).toHaveCount(0);
    await expect(
      page.getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Kiểm tra key" })
    ).toBeDisabled();
    await expect(
      page.getByText("Đang có request chấm trong phiên demo")
    ).toBeVisible();
  } finally {
    releaseGrade();
  }

  await expect(page.locator(".demo-env-picker")).toHaveCount(0);
  await expect(
    page.getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
  ).toBeEnabled();
});

test("the first Production grade needs the billable acknowledgement", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page
    .getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
    .fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();
  await openGradingStep(page);

  const gradingRequests: string[] = [];
  page.on("request", (browserRequest) => {
    if (new URL(browserRequest.url()).pathname === "/api/demo/scoring/grade")
      gradingRequests.push(
        browserRequest.headers()["x-demo-environment"] ?? "(none)"
      );
  });
  await page.getByRole("button", { name: /Chấm thật Task 1/ }).click();

  await expect(page.locator(".demo-error[role=alert]")).toContainText(
    "PRODUCTION_ACKNOWLEDGEMENT_REQUIRED"
  );
  expect(gradingRequests).toEqual([]);

  await page.getByTestId("production-acknowledgement").check();
  await page.getByRole("button", { name: /Chấm thật Task 1/ }).click();
  await expect(page.getByTestId("scoring-report")).toBeVisible();
  expect(gradingRequests).toEqual(["production"]);
});

test("a Sandbox visit reports its allowance apart from key validity", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page
    .getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
    .fill(sandboxKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();

  const allowance = page.getByTestId("sandbox-allowance");
  await expect(allowance).toContainText(
    "Organization 0/5; toàn Sandbox 0/500. Còn 5 lượt khả dụng cho key này."
  );
  await expect(page.locator(".demo-env-picker")).toHaveCount(0);
});

test("skipping key setup keeps the whole visit off the network", async ({
  page,
}) => {
  const calls = countDemoApiCalls(page);
  await openDemo(page, "scoring");
  await page.getByRole("button", { name: "Bỏ qua, dùng mẫu" }).click();
  await openGradingStep(page);
  await page.getByTestId("button-grade").click();

  await expect(page.getByTestId("scoring-report")).toBeVisible();
  expect(calls).toEqual([]);
});

test("a copied artifact names the selected host and never the supplied key", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page
    .getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
    .fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();
  await expect(page.getByTestId("production-key-warning")).toBeVisible();
  await openGradingStep(page);

  const artifact = page.getByTestId("export-artifact");
  await expect(artifact).toContainText("https://api.aihubproduction.com");
  await expect(artifact).not.toContainText(productionKey);

  for (const tab of ["PowerShell", "Postman cURL", "Agent prompt"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(artifact).toContainText("api.aihubproduction.com");
    await expect(artifact).not.toContainText(productionKey);
    if (tab === "Postman cURL")
      await expect(artifact).toContainText("{{aihub_api_key}}");
  }
});

test("a key entered in one demo skill is still there in the other", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page
    .getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
    .fill(demoKey);

  await page.getByRole("link", { name: "Speaking" }).click();
  await waitForHydration(page);
  await expect(
    page.getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
  ).toHaveValue(demoKey);
  await expect(page.locator(".demo-env-picker")).toHaveCount(0);
});

test("restoring the page from the back/forward cache clears the key", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page
    .getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
    .fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();
  await expect(page.getByTestId("production-key-warning")).toBeVisible();
  await page.getByTestId("production-acknowledgement").check();
  await page.getByRole("link", { name: "Speaking" }).click();
  await waitForHydration(page);
  await expect(page.locator(".demo-env-picker")).toHaveCount(0);
  await expect(page.getByTestId("production-acknowledgement")).toBeChecked();
  await expect(
    page.getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
  ).toHaveValue(productionKey);

  // The event the browser fires when it hands a page back from bfcache.
  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true })
    );
  });

  await expect(
    page.getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
  ).toHaveValue("");
  await expect(page.locator(".demo-env-picker")).toHaveCount(0);
  await expect(page.getByTestId("production-acknowledgement")).toHaveCount(0);
});

test("a logout in another tab clears the key the demo is holding", async ({
  page,
  request,
}) => {
  await request.post(`${mockUrl}/__test__/auth/reset`);
  await request.post(`${mockUrl}/__test__/organizations/config`, {
    data: {
      roster: [
        {
          organization_id: "org-keys-12345678",
          name: "API Keys Org",
          status: "active",
          identity_configured: false,
          entitlements: ["writing"],
          membership: { role: "owner" },
          members: [{ username: "owner", role: "owner" }],
        },
      ],
      apiKeys: [],
    },
  });
  await page.goto("/login");
  await waitForHydration(page);
  await page.getByLabel("Email").fill("valid@example.test");
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/console\/orgs\/org-keys-12345678$/);

  await openDemo(page, "speaking");
  await page
    .getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
    .fill(demoKey);
  await expect(
    page.getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
  ).toHaveValue(demoKey);
  await expect(page.locator(".demo-env-picker")).toHaveCount(0);

  const otherTab = await page.context().newPage();
  await otherTab.goto("/console/orgs/org-keys-12345678");
  await waitForHydration(otherTab);
  await otherTab.locator("details.account-menu > summary").click();
  await otherTab.getByRole("button", { name: "Đăng xuất" }).first().click();

  await expect(
    page.getByLabel("API key (Sandbox hoặc Production, tùy chọn)")
  ).toHaveValue("");
  await expect(page.locator(".demo-env-picker")).toHaveCount(0);
  await expect(page.getByTestId("production-acknowledgement")).toHaveCount(0);
  await otherTab.close();
});

const UUID =
  /Idempotency-Key: [0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

test("a Writing export sends the endpoint's body and an Idempotency-Key", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page.getByRole("button", { name: "Bỏ qua, dùng mẫu" }).click();
  const artifact = page.getByTestId("export-artifact");

  for (const task of [1, 2] as const) {
    if (task === 2) {
      await page.getByRole("button", { name: "Sửa bài" }).click();
      await page.getByRole("button", { name: "Quay lại đề" }).click();
    }
    await page.getByTestId(`tab-task-${task}`).click();
    await page.getByRole("button", { name: "Tiếp tục đến bài làm" }).click();
    await page.getByRole("button", { name: "Xem bước chấm" }).click();
    await expect(artifact).toContainText("--data-raw");
    await expect(artifact).toContainText(UUID);
    // `task` routes inside the BFF; the endpoint's schemas refuse it.
    await expect(artifact).not.toContainText(/"task"\s*:/);
    await expect(artifact).toContainText(
      task === 1 ? /"chart_type"\s*:/ : /"topic"\s*:/
    );
  }
});

test("the sequential flow creates an Idempotency-Key after key setup is skipped", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await expect(page.getByTestId("export-artifact")).toHaveCount(0);
  await page.getByRole("button", { name: "Bỏ qua, dùng mẫu" }).click();
  await page.getByRole("button", { name: "Tiếp tục đến bài làm" }).click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();

  await expect(page.getByTestId("export-artifact")).toContainText(UUID);
});

test("a Speaking export keeps the sample recording's own question", async ({
  page,
}) => {
  await openDemo(page, "speaking");
  await page.getByRole("button", { name: "Bỏ qua, dùng mẫu" }).click();
  await page.getByRole("button", { name: "Part 3" }).click();
  await page.locator(".demo-scenario-list button").nth(1).click();
  await page.getByRole("button", { name: "Tiếp tục đến câu trả lời" }).click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();

  const artifact = page.getByTestId("export-artifact");
  await expect(artifact).toContainText(
    /"question_id"\s*:\s*"p1_do-you-enjoy-living-in-your-city-or-hometown"/
  );
  await expect(artifact).toContainText(/"part"\s*:\s*1\b/);
  await expect(artifact).not.toContainText("p3_");
});
