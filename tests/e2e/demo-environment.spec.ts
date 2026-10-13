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

test("a demo visit starts on Sandbox and can be moved to Production", async ({
  page,
}) => {
  await openDemo(page, "scoring");

  const sandbox = page.getByTestId("demo-environment-sandbox");
  const production = page.getByTestId("demo-environment-production");
  await expect(sandbox).toBeChecked();
  await expect(production).not.toBeChecked();
  await expect(page.getByLabel("API key Sandbox (tùy chọn)")).toBeVisible();

  await production.check();
  await expect(production).toBeChecked();
  await expect(page.getByLabel("API key Production (tùy chọn)")).toBeVisible();
});

test("the Production billable acknowledgement appears and is cleared by a change", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  const acknowledgement = page.getByTestId("production-acknowledgement");
  await expect(acknowledgement).toHaveCount(0);

  await page.getByTestId("demo-environment-production").check();
  await expect(page.getByText(/có thể phát sinh chi phí thật/)).toBeVisible();
  await acknowledgement.check();
  await expect(acknowledgement).toBeChecked();

  await page.getByTestId("demo-environment-sandbox").check();
  await page.getByTestId("demo-environment-production").check();
  await expect(acknowledgement).not.toBeChecked();
});

test("a Production visit is refused a Sandbox key, and never falls back to one", async ({
  page,
}) => {
  const calls = countDemoApiCalls(page);
  await openDemo(page, "scoring");
  await page.getByTestId("demo-environment-production").check();
  await page.getByLabel("API key Production (tùy chọn)").fill(sandboxKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();

  await expect(page.locator(".demo-error[role=alert]")).toContainText(
    "FORBIDDEN"
  );
  await expect(page.getByTestId("demo-environment-production")).toBeChecked();
  expect(calls).toEqual(["/api/demo/key/validate"]);
});

test("a Production key opens live grading on the Production tier", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page.getByTestId("demo-environment-production").check();
  await page.getByLabel("API key Production (tùy chọn)").fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();

  await expect(
    page.getByRole("heading", { name: "Chọn bài Writing" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục đến bài làm" }).click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();
  await page.getByRole("tab", { name: "Request" }).click();
  const requestTrace = page.locator(".demo-console .demo-console-code");
  await expect(requestTrace).toContainText('"environment": "Production"');
  await expect(requestTrace).not.toContainText("bff_to_sandbox");
  await page.getByTestId("production-acknowledgement").check();
  await page.getByRole("button", { name: /Chấm thật Task 1/ }).click();

  await expect(page.getByTestId("scoring-report")).toBeVisible();
  await expect(page.getByText("LIVE RESPONSE").first()).toBeVisible();
});

test("the environment cannot change while a live grade is in flight", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page.getByTestId("demo-environment-production").check();
  await page.getByLabel("API key Production (tùy chọn)").fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();
  await page.getByRole("button", { name: "Tiếp tục đến bài làm" }).click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();
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
    await expect(
      page.getByTestId("demo-environment-production")
    ).toBeDisabled();
    await expect(page.getByTestId("demo-environment-sandbox")).toBeDisabled();
  } finally {
    releaseGrade();
  }

  await expect(page.getByTestId("scoring-report")).toBeVisible();
  await expect(page.getByText("LIVE RESPONSE").first()).toBeVisible();
});

test("the first Production grade needs the billable acknowledgement", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page.getByTestId("demo-environment-production").check();
  await page.getByLabel("API key Production (tùy chọn)").fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();
  await page.getByRole("button", { name: "Tiếp tục đến bài làm" }).click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();

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
  await page.getByLabel("API key Sandbox (tùy chọn)").fill(sandboxKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();

  const allowance = page.getByTestId("sandbox-allowance");
  await expect(allowance).toContainText(
    "còn 5 lượt khả dụng tháng này (Organization: 5/5; toàn Sandbox: 500/500)"
  );
  await expect(
    page.getByTestId("demo-environment-production")
  ).not.toBeChecked();
});

test("skipping key setup keeps the whole visit off the network", async ({
  page,
}) => {
  const calls = countDemoApiCalls(page);
  await openDemo(page, "scoring");
  await page.getByRole("button", { name: "Bỏ qua, dùng mẫu" }).click();
  await page.getByRole("button", { name: "Tiếp tục đến bài làm" }).click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();
  await page.getByTestId("button-grade").click();

  await expect(page.getByTestId("scoring-report")).toBeVisible();
  expect(calls).toEqual([]);
});

test("a copied artifact names the selected host and never the supplied key", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page.getByTestId("demo-environment-production").check();
  await page.getByLabel("API key Production (tùy chọn)").fill(demoKey);
  await page.getByRole("button", { name: "Bỏ qua, dùng mẫu" }).click();

  const artifact = page.getByTestId("export-artifact");
  await expect(artifact).toContainText("https://api.aihubproduction.com");
  await expect(artifact).not.toContainText(demoKey);

  for (const tab of ["PowerShell", "Postman JSON", "Agent prompt"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(artifact).toContainText("api.aihubproduction.com");
    await expect(artifact).not.toContainText(demoKey);
  }

  await page.getByTestId("demo-environment-sandbox").check();
  await expect(artifact).toContainText("https://sandbox.aihubproduction.com");
});

test("a key entered in one demo skill is still there in the other", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page.getByLabel("API key Sandbox (tùy chọn)").fill(demoKey);

  await page.getByRole("link", { name: "Speaking" }).click();
  await waitForHydration(page);
  await expect(page.getByLabel("API key Sandbox (tùy chọn)")).toHaveValue(
    demoKey
  );
  await expect(page.getByTestId("demo-environment-sandbox")).toBeChecked();
});

test("restoring the page from the back/forward cache clears the key", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page.getByLabel("API key Sandbox (tùy chọn)").fill(demoKey);
  await page.getByTestId("demo-environment-production").check();
  await page.getByTestId("production-acknowledgement").check();
  await expect(page.getByLabel("API key Production (tùy chọn)")).toHaveValue(
    demoKey
  );

  // The event the browser fires when it hands a page back from bfcache.
  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true })
    );
  });

  await expect(page.getByLabel("API key Sandbox (tùy chọn)")).toHaveValue("");
  await expect(page.getByTestId("demo-environment-sandbox")).toBeChecked();
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

  await openDemo(page, "scoring");
  await page.getByLabel("API key Sandbox (tùy chọn)").fill(demoKey);
  await page.getByTestId("demo-environment-production").check();
  await page.getByTestId("production-acknowledgement").check();
  await expect(page.getByLabel("API key Production (tùy chọn)")).toHaveValue(
    demoKey
  );

  const otherTab = await page.context().newPage();
  await otherTab.goto("/console/orgs/org-keys-12345678");
  await waitForHydration(otherTab);
  await otherTab.locator("details.account-menu > summary").click();
  await otherTab.getByRole("button", { name: "Đăng xuất" }).first().click();

  await expect(page.getByLabel("API key Sandbox (tùy chọn)")).toHaveValue("");
  await expect(page.getByTestId("demo-environment-sandbox")).toBeChecked();
  await expect(page.getByTestId("production-acknowledgement")).toHaveCount(0);
  await otherTab.close();
});
