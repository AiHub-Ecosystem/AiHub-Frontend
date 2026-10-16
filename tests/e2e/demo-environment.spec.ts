import { expect, test, type Page } from "@playwright/test";
import { waitForHydration } from "./hydration";

const mockUrl = "http://127.0.0.1:3101";
const password = "correct horse battery staple";
const demoKey = "aihub_sandbox_" + "A".repeat(43);
const productionKey = "aihub_prod_e2e_production_key";
const signedSandboxKey = "aihub_sk_e2e_signed_sandbox_key";

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
    "Kết quả mẫu có sẵn"
  );
  await expect(page.getByLabel("Mã API (không bắt buộc)")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Nhập mã API" })
  ).toBeVisible();
  const userIdentity = page.getByLabel("Declared User ID (X-User-Identity)");
  await expect(userIdentity).toHaveCount(0);
  await page.getByLabel("Mã API (không bắt buộc)").fill(demoKey);
  await page.getByRole("button", { name: "Xem bài mẫu" }).click();
  await expect(userIdentity).toHaveCount(0);
  await expect(page.locator(".demo-env-picker")).toHaveCount(0);

  await page.getByRole("link", { name: "Speaking", exact: true }).click();
  await waitForHydration(page);
  await expect(page.locator(".demo-env-picker")).toHaveCount(0);
  await expect(page.locator(".demo-flow-statuses .demo-mode-badge")).toHaveText(
    "Kết quả mẫu có sẵn"
  );
  await expect(page.getByLabel("Mã API (không bắt buộc)")).toBeVisible();
  const speakingIdentity = page.getByLabel(
    "Declared User ID (X-User-Identity)"
  );
  await expect(speakingIdentity).toHaveCount(0);
  await page.getByRole("button", { name: "Xem câu hỏi mẫu" }).click();
  await expect(
    page.getByRole("heading", { name: "Chọn câu hỏi Speaking" })
  ).toBeVisible();
  await expect(speakingIdentity).toHaveCount(0);
});

test("Speaking detects a Production key and clears its acknowledgement on Sandbox change", async ({
  page,
}) => {
  await openDemo(page, "speaking");
  const apiKey = page.getByLabel("Mã API (không bắt buộc)");
  const acknowledgement = page.getByTestId("production-acknowledgement");
  await expect(acknowledgement).toHaveCount(0);

  await apiKey.fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  await expect(page.getByTestId("production-key-warning")).toBeVisible();
  await acknowledgement.check();
  await expect(acknowledgement).toBeChecked();

  await page.getByRole("button", { name: "Quay lại nhập mã API" }).click();
  await apiKey.fill(demoKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  await expect(page.getByTestId("sandbox-allowance")).toBeVisible();
  await expect(acknowledgement).toHaveCount(0);
});

test("an environment-less key can select Production before validation", async ({
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
    .getByLabel("Mã API (không bắt buộc)")
    .fill("aihub_sk_e2e_legacy_production_key");
  await expect(page.locator(".demo-env-picker")).toBeVisible();
  await page.getByTestId("demo-environment-production").check();
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();

  await expect(page.getByTestId("production-key-warning")).toBeVisible();
  expect(validationEnvironments).toEqual(["production"]);
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
  await page.getByLabel("Mã API (không bắt buộc)").fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();

  await expect(page.getByTestId("production-key-warning")).toContainText(
    "Mã API dùng cho môi trường tính phí đã được xác nhận"
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
  await page.getByLabel("Mã API (không bắt buộc)").fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();

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
  const userIdentity = "customer_42";
  await page.getByLabel("Mã API (không bắt buộc)").fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  await expect(page.getByTestId("production-key-warning")).toBeVisible();
  await page
    .getByLabel("Declared User ID (X-User-Identity)")
    .fill(userIdentity);

  await expect(
    page.getByRole("heading", { name: "Chọn bài Writing" })
  ).toBeVisible();
  await openGradingStep(page);
  await page.getByRole("tab", { name: "Thông tin gửi đi" }).click();
  const requestTrace = page.locator(".demo-console .demo-console-code");
  await expect(requestTrace).toContainText("https://api.aihubproduction.com/");
  await expect(requestTrace).toContainText(
    `"X-User-Identity": "${userIdentity}"`
  );
  await expect(requestTrace).not.toContainText("bff_to_sandbox");
  const submittedIdentities: string[] = [];
  page.on("request", (browserRequest) => {
    if (new URL(browserRequest.url()).pathname === "/api/demo/scoring/grade")
      submittedIdentities.push(
        browserRequest.headers()["x-demo-user-identity"] ?? "(missing)"
      );
  });
  await page.getByTestId("production-acknowledgement").check();
  await page.getByRole("button", { name: /Chấm thật Task 1/ }).click();

  await expect(page.getByTestId("scoring-report")).toBeVisible();
  await expect(page.getByText("KẾT QUẢ CHẤM THẬT").first()).toBeVisible();
  expect(submittedIdentities).toEqual([userIdentity]);
});

test("the Production acknowledgement is locked while a grade is in flight", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page.getByLabel("Mã API (không bắt buộc)").fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
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
    await expect(
      page.getByText(/Đang chấm bài.*tải lại trang.*kết quả có thể bị mất/)
    ).toBeVisible();

    const dialogPromise = page.waitForEvent("dialog", { timeout: 5_000 });
    const closePromise = page.close({ runBeforeUnload: true });
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe("beforeunload");
    await dialog.dismiss();
    await closePromise;
    await expect(
      page.getByText(/Đang chấm bài.*tải lại trang.*kết quả có thể bị mất/)
    ).toBeVisible();
  } finally {
    releaseGrade();
  }

  await expect(page.getByTestId("scoring-report")).toBeVisible();
  await expect(page.getByText("KẾT QUẢ CHẤM THẬT").first()).toBeVisible();
});

test("the shared key and environment stay locked across skills during grading", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page.getByLabel("Mã API (không bắt buộc)").fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
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
    await expect(page.getByLabel("Mã API (không bắt buộc)")).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Kiểm tra mã API" })
    ).toBeDisabled();
    await expect(
      page.getByText(/Đang chấm bài.*tải lại trang.*kết quả có thể bị mất/)
    ).toBeVisible();
  } finally {
    releaseGrade();
  }

  await expect(page.locator(".demo-env-picker")).toHaveCount(0);
  await expect(page.getByLabel("Mã API (không bắt buộc)")).toBeEnabled();
});

test("the first Production grade needs the billable acknowledgement", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page.getByLabel("Mã API (không bắt buộc)").fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
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
    "Hãy xác nhận trong phần “Nơi chấm bài” rằng môi trường thật có thể phát sinh chi phí."
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
  await page.getByLabel("Mã API (không bắt buộc)").fill(demoKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();

  const allowance = page.getByTestId("sandbox-allowance");
  await expect(allowance).toContainText(
    "Tổ chức của bạn đã dùng 0/5 lượt chấm miễn phí trong tháng."
  );
  await expect(allowance).not.toContainText("500");
  await expect(page.locator(".demo-env-picker")).toHaveCount(0);
});

test("skipping key setup keeps the whole visit off the network", async ({
  page,
}) => {
  const calls = countDemoApiCalls(page);
  await openDemo(page, "scoring");
  await page.getByRole("button", { name: "Xem bài mẫu" }).click();
  await openGradingStep(page);
  await page.getByTestId("button-grade").click();

  await expect(page.getByTestId("scoring-report")).toBeVisible();
  expect(calls).toEqual([]);
});

test("request details and commands use the validated key without putting it in the AI prompt", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  const userIdentity = "customer_42";
  await page.getByLabel("Mã API (không bắt buộc)").fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  await expect(page.getByTestId("production-key-warning")).toBeVisible();
  await page
    .getByLabel("Declared User ID (X-User-Identity)")
    .fill(userIdentity);
  await openGradingStep(page);

  const artifact = page.getByTestId("export-artifact");
  await expect(artifact).toContainText("https://api.aihubproduction.com");
  await expect(artifact).toContainText(productionKey);
  await expect(artifact).toContainText(`X-User-Identity: ${userIdentity}`);
  await expect(page.locator(".demo-console .demo-console-code")).toContainText(
    `"X-API-Key": "${productionKey}"`
  );
  await expect(page.locator(".demo-console .demo-console-code")).toContainText(
    `"X-User-Identity": "${userIdentity}"`
  );
  await expect(page.locator(".demo-console-note").first()).toContainText(
    "Hãy giữ kín"
  );

  for (const tab of ["PowerShell", "Postman cURL"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(artifact).toContainText("api.aihubproduction.com");
    await expect(artifact).toContainText(productionKey);
  }

  await page.getByRole("tab", { name: "Hướng dẫn tạo lệnh" }).click();
  await expect(artifact).not.toContainText(productionKey);
});

test("declared identity is shared across skills after each scope validates", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page.getByLabel("Mã API (không bắt buộc)").fill(demoKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  await expect(page.getByTestId("sandbox-allowance")).toBeVisible();
  await page.getByLabel("Declared User ID (X-User-Identity)").fill("learner_7");

  await page.getByRole("link", { name: "Speaking" }).click();
  await waitForHydration(page);
  await expect(page.getByLabel("Mã API (không bắt buộc)")).toHaveValue(demoKey);
  const speakingIdentity = page.getByLabel(
    "Declared User ID (X-User-Identity)"
  );
  await expect(speakingIdentity).toHaveCount(0);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  await expect(
    page.getByRole("heading", { name: "Chọn câu hỏi Speaking" })
  ).toBeVisible();
  await expect(speakingIdentity).toHaveValue("learner_7");
  await expect(page.locator(".demo-env-picker")).toHaveCount(0);
});

test("signed assertion is shared across skills and cleared when key or environment changes", async ({
  page,
}) => {
  const assertion = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTQyIn0.signature";
  await openDemo(page, "scoring");
  await page.getByLabel("Mã API (không bắt buộc)").fill(signedSandboxKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  const writingEndpoint = page.getByLabel("URL endpoint cấp assertion (HTTPS)");
  await writingEndpoint.fill("https://customer.example.test/demo/assertion");
  await page.getByText("Nhập assertion thủ công").click();
  const writingIdentity = page.getByLabel(
    "Signed User Assertion (JWT) (X-User-Identity)"
  );
  await writingIdentity.fill(assertion);

  await page.getByRole("link", { name: "Speaking", exact: true }).click();
  await waitForHydration(page);
  const speakingIdentity = page.getByLabel(
    "Signed User Assertion (JWT) (X-User-Identity)"
  );
  await expect(speakingIdentity).toHaveCount(0);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  await expect(
    page.getByLabel("URL endpoint cấp assertion (HTTPS)")
  ).toHaveValue("https://customer.example.test/demo/assertion");
  await page.getByText("Nhập assertion thủ công").click();
  await expect(speakingIdentity).toHaveValue(assertion);

  await page.getByRole("button", { name: "Quay lại nhập mã API" }).click();
  await page.getByLabel("Mã API (không bắt buộc)").fill(demoKey);
  await expect(speakingIdentity).toHaveCount(0);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  const declaredIdentity = page.getByLabel(
    "Declared User ID (X-User-Identity)"
  );
  await expect(declaredIdentity).toHaveValue(/^[0-9a-f-]{36}$/);
  await expect(declaredIdentity).not.toHaveValue(assertion);

  await page.getByRole("button", { name: "Quay lại nhập mã API" }).click();
  await page.getByLabel("Mã API (không bắt buộc)").fill(signedSandboxKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  const renewedSignedIdentity = page.getByLabel(
    "Signed User Assertion (JWT) (X-User-Identity)"
  );
  await expect(
    page.getByLabel("URL endpoint cấp assertion (HTTPS)")
  ).toHaveValue("");
  await page.getByText("Nhập assertion thủ công").click();
  await expect(renewedSignedIdentity).toHaveValue("");
  await renewedSignedIdentity.fill(assertion);
  await page
    .getByLabel("URL endpoint cấp assertion (HTTPS)")
    .fill("https://customer.example.test/demo/assertion");
  await page.getByTestId("demo-environment-production").check();
  await expect(renewedSignedIdentity).toHaveCount(0);
  await page.getByTestId("demo-environment-sandbox").check();
  await page.getByRole("button", { name: "Quay lại nhập mã API" }).click();
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  await expect(
    page.getByLabel("URL endpoint cấp assertion (HTTPS)")
  ).toHaveValue("");
  await page.getByText("Nhập assertion thủ công").click();
  await expect(renewedSignedIdentity).toHaveValue("");
});

test("restoring the page from the back/forward cache clears the key", async ({
  page,
}) => {
  await openDemo(page, "scoring");
  await page.getByLabel("Mã API (không bắt buộc)").fill(productionKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  await expect(page.getByTestId("production-key-warning")).toBeVisible();
  await page.getByTestId("production-acknowledgement").check();
  await page.getByRole("link", { name: "Speaking" }).click();
  await waitForHydration(page);
  await expect(page.locator(".demo-env-picker")).toHaveCount(0);
  await expect(page.getByTestId("production-acknowledgement")).toBeChecked();
  await expect(page.getByLabel("Mã API (không bắt buộc)")).toHaveValue(
    productionKey
  );

  // The event the browser fires when it hands a page back from bfcache.
  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true })
    );
  });

  await expect(page.getByLabel("Mã API (không bắt buộc)")).toHaveValue("");
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
  await page.getByLabel("Mã API (không bắt buộc)").fill(demoKey);
  await expect(page.getByLabel("Mã API (không bắt buộc)")).toHaveValue(demoKey);
  await expect(page.locator(".demo-env-picker")).toHaveCount(0);

  const otherTab = await page.context().newPage();
  await otherTab.goto("/console/orgs/org-keys-12345678");
  await waitForHydration(otherTab);
  await otherTab.locator("details.account-menu > summary").click();
  await otherTab.getByRole("button", { name: "Đăng xuất" }).first().click();

  await expect(page.getByLabel("Mã API (không bắt buộc)")).toHaveValue("");
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
  await page.getByRole("button", { name: "Xem bài mẫu" }).click();
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
  await page.getByRole("button", { name: "Xem bài mẫu" }).click();
  await page.getByRole("button", { name: "Tiếp tục đến bài làm" }).click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();

  await expect(page.getByTestId("export-artifact")).toContainText(UUID);
});

test("a Speaking export keeps the sample recording's own question", async ({
  page,
}) => {
  await page.route("**/api/demo/speaking/questions?part=*", (route) => {
    const part = Number(
      new URL(route.request().url()).searchParams.get("part")
    );
    const questions = Array.from({ length: 2 }, (_, index) => ({
      id: `p${part}_catalog_${index + 1}`,
      part,
      question: `Catalog question Part ${part} ${index + 1}`,
      sampleAudioUrl: `https://s3.wispace.app/aihub-speaking-samples/speaking-samples/part-${part}/sample-${index + 1}.webm?X-Amz-Expires=900`,
    }));
    return route.fulfill({ status: 200, json: { data: { part, questions } } });
  });
  await openDemo(page, "speaking");
  await page.getByRole("button", { name: "Xem câu hỏi mẫu" }).click();
  await page.getByRole("button", { name: "Part 3" }).click();
  await page
    .locator(".demo-scenario-list")
    .getByText("Catalog question Part 3 2")
    .click();
  await page.getByRole("button", { name: "Tiếp tục đến câu trả lời" }).click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();

  const artifact = page.getByTestId("export-artifact");
  await expect(artifact).toContainText(
    /"question_id"\s*:\s*"p1_do-you-enjoy-living-in-your-city-or-hometown"/
  );
  await expect(artifact).toContainText(/"part"\s*:\s*1\b/);
  await expect(artifact).not.toContainText("p3_");
});
