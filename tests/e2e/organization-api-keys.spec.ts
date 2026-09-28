import {
  WRITING_TASK1_CHART_TYPES,
  WRITING_TASK1_REQUEST,
} from "@/data/writing-task1-request";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const mockUrl = "http://127.0.0.1:3101";
const password = "correct horse battery staple";
const identityReadinessTitle = "Xác thực có chữ ký được khuyến nghị";
const identityReadinessBody =
  "Organization hiện dùng Declared User ID: bất kỳ ai có API key của Organization đều có thể gửi yêu cầu dưới ID của bất kỳ End-User nào mà không cần chữ ký. Có thể cấu hình identity để AIHUB xác minh Signed User Assertion.";

async function setup(
  request: APIRequestContext,
  options: {
    membershipRole?: string;
    organizationStatus?: string;
    entitlements?: string[];
    apiKeys?: unknown[];
    [key: string]: unknown;
  } = {}
) {
  const {
    membershipRole = "owner",
    organizationStatus = "active",
    identityConfigured = false,
    entitlements = ["writing"],
    apiKeys = [
      {
        id: "ak_01J00000000000000000000000",
        name: "Production backend",
        key_prefix: "aihub_sk_ABC123",
        scopes: ["writing.grade"],
        allowed_environments: ["production"],
        status: "active",
        expires_at: "2026-11-15T12:00:00.000Z",
        last_used_at: null,
        created_at: "2026-09-20T10:00:00.000Z",
      },
      {
        id: "ak_01J00000000000000000000001",
        name: "Expired staging key",
        key_prefix: "aihub_sk_DEF456",
        scopes: ["writing.grade"],
        allowed_environments: ["staging"],
        status: "expired",
        expires_at: "2026-09-21T10:00:00.000Z",
        last_used_at: "2026-09-22T08:00:00.000Z",
        created_at: "2026-08-20T10:00:00.000Z",
      },
    ],
    ...mockOptions
  } = options;
  await request.post(`${mockUrl}/__test__/auth/reset`);
  await request.post(`${mockUrl}/__test__/organizations/config`, {
    data: {
      roster: [
        {
          organization_id: "org-keys-12345678",
          name: "API Keys Org",
          status: organizationStatus,
          identity_configured: identityConfigured,
          entitlements,
          membership: { role: membershipRole },
          members: [{ username: "owner", role: membershipRole }],
        },
      ],
      apiKeys,
      ...mockOptions,
    },
  });
}

/** Follows the reveal dialog's link, which opens the Quickstart in a new tab. */
async function openQuickstartFromDialog(page: Page) {
  const [quickstart] = await Promise.all([
    page.waitForEvent("popup"),
    page
      .getByRole("dialog", { name: "API key mới" })
      .getByRole("link", { name: /Gọi thử key này/ })
      .click(),
  ]);
  await quickstart.waitForLoadState();
  return quickstart;
}

async function signIn(page: Page, openApiKeys = true) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill("valid@example.test");
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/console\/orgs\/org-keys-12345678$/);
  if (openApiKeys) await page.goto("/console/orgs/org-keys-12345678/api-keys");
}

test("owner sees active and expired API keys with their metadata", async ({
  page,
  request,
}) => {
  await setup(request);
  await signIn(page);

  await expect(page).toHaveURL(/\/console\/orgs\/org-keys-12345678\/api-keys$/);
  const readinessNotice = page.getByRole("status");
  await expect(
    readinessNotice.getByText(identityReadinessTitle, { exact: true })
  ).toBeVisible();
  await expect(
    readinessNotice.getByText(identityReadinessBody, { exact: true })
  ).toBeVisible();
  await expect(readinessNotice.getByText(/Cấu hình identity/)).toBeVisible();
  await expect(page.getByText(/setup chưa hoàn tất/i)).toHaveCount(0);
  await expect(page.getByText("IDENTITY_CONFIG_REQUIRED")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Cấu hình identity" })
  ).toBeVisible();
  const table = page.getByRole("table", { name: "API keys" });
  await expect(table).toBeVisible({ timeout: 15_000 });
  await expect(table.getByText("Production backend")).toBeVisible();
  await expect(table.getByText("aihub_sk_ABC123")).toBeVisible();
  await expect(table.getByText("writing.grade")).toHaveCount(2);
  await expect(table.getByText("Expired staging key")).toBeVisible();
  await expect(
    table.getByRole("row", { name: /Expired staging key/ }).getByText("Hết hạn")
  ).toBeVisible();
});

test("active admins can open the API-key inventory", async ({
  page,
  request,
}) => {
  await setup(request, { membershipRole: "admin" });
  await signIn(page);

  await expect(
    page
      .getByRole("table", { name: "API keys" })
      .getByText("Production backend")
  ).toBeVisible();
});

test("empty state and stable create denials explain what to do next", async ({
  page,
  request,
}) => {
  await setup(request, { apiKeys: [] });
  await signIn(page);
  await expect(page.locator(".api-key-empty")).toContainText("Chưa có API key");

  await page.getByText("Tạo API key", { exact: true }).click();
  await page.getByLabel("Tên API key").fill("Denied key");
  await page.locator('input[name="scopes"][value="writing.grade"]').check();

  await request.post(`${mockUrl}/__test__/organizations/config`, {
    data: { apiKeyLimitReached: true },
  });
  await page.getByRole("button", { name: "Tạo key" }).click();
  await expect(
    page.getByText("Organization đã đạt giới hạn 50 API key", { exact: false })
  ).toBeVisible();

  await request.post(`${mockUrl}/__test__/organizations/config`, {
    data: { apiKeyLimitReached: false, apiKeyEntitlementDenied: true },
  });
  await page.getByRole("button", { name: "Tạo key" }).click();
  await expect(page.getByText(/không còn entitlement/)).toBeVisible();
});

test("creation uses roster scopes and reveals the raw key only once", async ({
  page,
  request,
}) => {
  let rawKeyToWatch = "";
  let requestContainsRawKey = false;
  let apiRequestCount = 0;
  page.on("request", (browserRequest) => {
    if (new URL(browserRequest.url()).pathname.startsWith("/api/"))
      apiRequestCount += 1;
    if (
      rawKeyToWatch &&
      `${browserRequest.url()}\n${browserRequest.postData() ?? ""}`.includes(
        rawKeyToWatch
      )
    )
      requestContainsRawKey = true;
  });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await setup(request, { apiKeys: [] });
  await signIn(page);
  await page.getByText("Tạo API key", { exact: true }).click();

  const writing = page.locator('input[name="scopes"][value="writing.grade"]');
  const speaking = page.locator('input[name="scopes"][value="speaking.grade"]');
  await expect(writing).not.toBeChecked();
  await expect(speaking).toBeDisabled();
  await expect(page.getByText(identityReadinessTitle)).toBeVisible();
  await expect(
    page.getByText(/Speaking chưa được bật cho Organization/)
  ).toBeVisible();
  await expect(page.getByText("Môi trường được phép")).toHaveCount(0);

  await page.getByLabel("Tên API key").fill("New service key");
  await writing.check();
  const responsePromise = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith("/api/organizations/org-keys-12345678/api-keys") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Tạo key" }).click();
  const response = await responsePromise;
  expect(response.headers()["cache-control"]).toBe("no-store");

  const dialog = page.getByRole("dialog", { name: "API key mới" });
  await expect(dialog).toBeVisible();
  const rawKey = await page.getByTestId("api-key-raw").textContent();
  expect(rawKey).toMatch(/^aihub_sk_[A-Za-z0-9]{43}$/);
  rawKeyToWatch = rawKey ?? "";
  await expect(dialog.getByText(/chỉ hiển thị lần này/)).toBeVisible();
  await expect(
    dialog.getByRole("tablist", { name: "Sample requests" })
  ).toHaveCount(0);
  const requestsBeforeCopy = apiRequestCount;
  await dialog.getByRole("button", { name: "Sao chép key" }).click();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(rawKey);
  expect(apiRequestCount).toBe(requestsBeforeCopy);

  const quickstart = await openQuickstartFromDialog(page);
  await expect(quickstart).toHaveURL(
    /\/console\/orgs\/org-keys-12345678\/api-keys\/ak_[0-9]+\/quickstart$/
  );
  await expect(
    quickstart.getByRole("heading", { name: "New service key · Quickstart" })
  ).toBeVisible();
  expect(quickstart.url()).not.toContain(rawKey);
  expect(await quickstart.content()).not.toContain(rawKey);
  await quickstart.close();
  // Following the link never costs the holder their key.
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("api-key-raw")).toHaveText(rawKey ?? "");
  expect(requestContainsRawKey).toBe(false);
  await expect(
    page.getByRole("row", { name: /New service key/ })
  ).toBeVisible();

  const requests = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((result) => result.json());
  expect(JSON.stringify(requests)).not.toContain(rawKey);
  await page.getByRole("button", { name: "Đóng" }).click();
  await expect(page.getByTestId("api-key-raw")).toHaveCount(0);
  const browserStorageAfterClose = await page.evaluate(() =>
    JSON.stringify({ local: localStorage, session: sessionStorage })
  );
  expect(browserStorageAfterClose).not.toContain(rawKey);
  await page
    .getByRole("row", { name: /New service key/ })
    .getByRole("button", { name: "Xoay key" })
    .click();
  const rotatedRawKey = `aihub_sk_${"B".repeat(43)}`;
  await expect(page.getByTestId("api-key-raw")).toHaveText(rotatedRawKey);
  await page.getByRole("button", { name: "Đóng" }).click();
  await page.reload();
  await expect(page.getByTestId("api-key-raw")).toHaveCount(0);
  await expect(
    page.getByRole("row", { name: /New service key/ })
  ).toBeVisible();
  await page.goto("/console/orgs/org-keys-12345678");
  await page.goBack();
  await expect(page).toHaveURL(/\/console\/orgs\/org-keys-12345678\/api-keys$/);
  await expect(page.getByTestId("api-key-raw")).toHaveCount(0);
  const browserStorage = await page.evaluate(() =>
    JSON.stringify({ local: localStorage, session: sessionStorage })
  );
  expect(browserStorage).not.toContain(rawKey);
});

test("a key holding writing.grade shows a Task 1 request beside Task 2", async ({
  page,
  request,
}) => {
  await setup(request, {
    apiKeys: [
      {
        id: "ak_01J00000000000000000000006",
        name: "Writing backend",
        key_prefix: "aihub_sk_WRITING",
        scopes: ["writing.grade"],
        allowed_environments: ["production"],
        status: "active",
        expires_at: null,
        last_used_at: null,
        created_at: "2026-09-20T10:00:00.000Z",
      },
    ],
  });
  await signIn(page);
  await page
    .getByRole("row", { name: /Writing backend/ })
    .getByRole("link", { name: "Gọi thử" })
    .click();

  const tablist = page.getByRole("tablist", { name: "Sample requests" });
  await expect(tablist.getByRole("tab")).toHaveText([
    "Writing Task 1",
    "Writing Task 2",
  ]);

  const task1 = page.getByRole("tabpanel", { name: "Writing Task 1" });
  await expect(task1).toBeVisible();
  await expect(
    task1.getByText(
      "https://api.aihubproduction.com/v1/ielts/writing/task1/grade",
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    task1
      .getByRole("table", { name: "Writing Task 1 request body" })
      .locator("tbody th")
  ).toHaveText(Object.keys(WRITING_TASK1_REQUEST));
  const chartTypeRow = task1
    .getByRole("table", { name: "Writing Task 1 request body" })
    .getByRole("row", { name: "chart_type" });
  for (const chartType of WRITING_TASK1_CHART_TYPES)
    await expect(chartTypeRow).toContainText(chartType);
  await expect(chartTypeRow).toContainText("HOA THƯỜNG");
  await expect(chartTypeRow).toContainText("environment");
  await expect(
    task1
      .getByRole("table", { name: "Writing Task 1 request body" })
      .getByRole("row", { name: /image_url/ })
  ).toContainText("https://s3.wispace.app/ielts-task1/ca95bd4ab522946d");
  await expect(task1.getByText(/URL giữ chỗ/)).toHaveCount(0);
  await expect(task1.getByText(/biểu đồ mẫu AIHUB công bố/)).toBeVisible();
  await expect(
    task1.getByText(/không trả lỗi khi không tải được ảnh/)
  ).toBeVisible();
  await expect(task1.getByText(/kết quả sẽ sai/)).toBeVisible();
  await expect(
    task1
      .getByRole("table", { name: "Writing Task 1 request headers" })
      .getByRole("row", { name: /Idempotency-Key/ })
  ).toBeVisible();
  await expect(
    task1.getByText("task_achievement", { exact: true })
  ).toBeVisible();
  await expect(task1.getByTestId("sample-request-command")).toContainText(
    "task1/grade"
  );
  await expect(task1.getByTestId("sample-request-command")).toContainText(
    `IDEMPOTENCY_KEY='`
  );

  const task2 = page.getByRole("tabpanel", { name: "Writing Task 2" });
  await expect(task2).toHaveCount(0);
  await tablist.getByRole("tab", { name: "Writing Task 2" }).click();
  await expect(task2).toBeVisible();
  await expect(task2.getByText(/biểu đồ mẫu AIHUB công bố/)).toHaveCount(0);
});

test("a key holding both scopes shows one tab per request, Writing first", async ({
  page,
  request,
}) => {
  await setup(request, {
    apiKeys: [
      {
        id: "ak_01J00000000000000000000007",
        name: "Both scopes key",
        key_prefix: "aihub_sk_BOTH12",
        scopes: ["writing.grade", "speaking.grade"],
        allowed_environments: ["production"],
        status: "active",
        expires_at: null,
        last_used_at: null,
        created_at: "2026-09-20T10:00:00.000Z",
      },
    ],
    entitlements: ["writing", "speaking"],
  });
  await signIn(page, false);
  await page.goto(quickstartPath("ak_01J00000000000000000000007"));

  const tablist = page.getByRole("tablist", { name: "Sample requests" });
  await expect(tablist.getByRole("tab")).toHaveText([
    "Writing Task 1",
    "Writing Task 2",
    "Speaking",
  ]);
  await expect(
    tablist.getByRole("tab", { name: "Writing Task 1" })
  ).toHaveAttribute("aria-selected", "true");

  // One scope now yields two requests. Exactly one tab may be current, exactly
  // one may sit in the tab order, and the tabs may not share an element id.
  const tabs = tablist.getByRole("tab");
  await expect(tabs).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    await expect(tabs.nth(index)).toHaveAttribute(
      "aria-selected",
      index === 0 ? "true" : "false"
    );
    await expect(tabs.nth(index)).toHaveAttribute(
      "tabindex",
      index === 0 ? "0" : "-1"
    );
  }
  const tabIds = await tabs.evaluateAll((nodes) =>
    nodes.map((node) => node.id)
  );
  expect(new Set(tabIds).size).toBe(3);
  const controlledPanels = await tabs.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-controls"))
  );
  expect(new Set(controlledPanels).size).toBe(3);

  const writing = page.getByRole("tabpanel", { name: "Writing Task 2" });
  await expect(writing).toHaveCount(0);
  await tablist.getByRole("tab", { name: "Writing Task 2" }).click();
  await expect(writing).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "Speaking" })).toHaveCount(0);
  await expect(
    writing
      .getByRole("table", { name: "Writing Task 2 request headers" })
      .getByRole("row", {
        name: /Idempotency-Key/,
      })
  ).toBeVisible();
  await expect(writing.getByTestId("sample-request-command")).toContainText(
    "IDEMPOTENCY_KEY="
  );
  const writingNotePosition = await writing.evaluate((panel) => {
    // Document order of the panel's reading blocks, however they are nested.
    const nodes = Array.from(panel.querySelectorAll("p, table, h3"));
    const at = (matches: (node: Element) => boolean) =>
      nodes.findIndex((node) => matches(node));
    return {
      note: at((node) =>
        (node.textContent ?? "").includes("Bài nộp mới cần một UUID mới")
      ),
      body: at(
        (node) =>
          node.getAttribute("aria-label") === "Writing Task 2 request body"
      ),
      outcome: at((node) =>
        (node.textContent ?? "").includes("Kết quả dự kiến")
      ),
    };
  });
  expect(writingNotePosition.note).toBeGreaterThan(writingNotePosition.body);
  expect(writingNotePosition.note).toBeLessThan(writingNotePosition.outcome);

  const task1Tab = tablist.getByRole("tab", { name: "Writing Task 1" });
  const writingTab = tablist.getByRole("tab", { name: "Writing Task 2" });
  const speakingTab = tablist.getByRole("tab", { name: "Speaking" });
  const task1Panel = page.getByRole("tabpanel", { name: "Writing Task 1" });
  const writingPanel = page.getByRole("tabpanel", { name: "Writing Task 2" });
  const speakingPanel = page.getByRole("tabpanel", { name: "Speaking" });

  // Three tabs now. Every step starts from the selected tab, so the arrow keys
  // are exercised from the origin a user would actually see.
  await writingTab.press("End");
  await expect(speakingPanel).toBeVisible();
  await speakingTab.press("ArrowRight");
  await expect(task1Panel).toBeVisible();
  await task1Tab.press("ArrowRight");
  await expect(writingPanel).toBeVisible();
  await writingTab.press("ArrowLeft");
  await expect(task1Panel).toBeVisible();
  await task1Tab.press("Home");
  await expect(task1Panel).toBeVisible();
  await writingTab.press("End");
  await expect(speakingPanel).toBeVisible();

  const speaking = speakingPanel;
  await expect(speakingTab).toHaveAttribute("aria-selected", "true");
  await expect(
    speaking.getByText(
      "https://api.aihubproduction.com/v1/ielts/speaking/grading-json",
      { exact: true }
    )
  ).toBeVisible();

  const headers = speaking.getByRole("table", {
    name: "Speaking request headers",
  });
  await expect(
    headers.getByRole("row", { name: /Idempotency-Key/ })
  ).toHaveCount(0);
  await expect(
    headers.getByRole("row", { name: /Content-Type/ })
  ).toBeVisible();
  await expect(speaking.getByText(/chưa hỗ trợ Idempotency-Key/)).toBeVisible();
  await expect(speaking.getByText(/chấm bài và tính phí/)).toBeVisible();
  // The note tells a holder with their own audio how to grade it instead.
  await expect(speaking.getByText(/chưa hỗ trợ Idempotency-Key/)).toContainText(
    "POST /v1/ielts/speaking/grading"
  );
  await expect(
    speaking
      .getByRole("table", { name: "Speaking request body" })
      .getByRole("row", { name: /audio_url/ })
  ).toContainText(
    "https://s3.wispace.app/ielts-task1/speaking-answers/part-1/do-you-enjoy-living-in-your-city-or-hometown.webm"
  );

  const command = await speaking
    .getByTestId("sample-request-command")
    .innerText();
  expect(command).not.toContain("answer.wav");
  expect(command).not.toContain("Idempotency-Key");
});

test("a key holding only speaking.grade shows only the Speaking tab", async ({
  page,
  request,
}) => {
  await setup(request, {
    apiKeys: [
      {
        id: "ak_01J00000000000000000000003",
        name: "Speaking backend",
        key_prefix: "aihub_sk_SPEAK",
        scopes: ["speaking.grade"],
        allowed_environments: ["production"],
        status: "active",
        expires_at: null,
        last_used_at: null,
        created_at: "2026-09-20T10:00:00.000Z",
      },
    ],
  });
  await signIn(page);
  await page
    .getByRole("row", { name: /Speaking backend/ })
    .getByRole("link", { name: "Gọi thử" })
    .click();

  const tablist = page.getByRole("tablist", { name: "Sample requests" });
  await expect(tablist.getByRole("tab")).toHaveText(["Speaking"]);
  const speaking = page.getByRole("tabpanel", { name: "Speaking" });
  await expect(speaking).toBeVisible();
  const body = speaking.getByRole("table", { name: "Speaking request body" });
  await expect(body).toContainText("question_id");
  await expect(body).toContainText(
    "p1_do-you-enjoy-living-in-your-city-or-hometown"
  );
});

test("a revealed key with no Sample request offers no Quickstart", async ({
  page,
  request,
}) => {
  await setup(request, {
    apiKeys: [
      {
        id: "ak_01J00000000000000000000004",
        name: "Unknown scope key",
        key_prefix: "aihub_sk_UNKNWN",
        scopes: ["speech.toText"],
        allowed_environments: ["production"],
        status: "active",
        expires_at: null,
        last_used_at: null,
        created_at: "2026-09-20T10:00:00.000Z",
      },
    ],
  });
  await signIn(page);
  await page
    .getByRole("row", { name: /Unknown scope key/ })
    .getByRole("button", { name: "Xoay key" })
    .click();

  await expect(page.getByTestId("api-key-raw")).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Sample requests" })
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Gọi thử/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Sao chép lệnh/ })).toHaveCount(
    0
  );
});

test("create timeout refreshes the list without automatically retrying", async ({
  page,
  request,
}) => {
  await setup(request, { apiKeys: [], createKeyUncertainOnce: true });
  await signIn(page);
  await page.getByText("Tạo API key", { exact: true }).click();
  await page.getByLabel("Tên API key").fill("Possibly created key");
  await page.locator('input[name="scopes"][value="writing.grade"]').check();
  await page.getByRole("button", { name: "Tạo key" }).click();

  await expect(page.getByText(/Không tự gửi lại/)).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Possibly created key/ })
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const requests = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((result) => result.json());
  const createRequest = requests.requests.find(
    (entry: { path: string }) => entry.path === "create-api-key"
  );
  expect(createRequest).toMatchObject({ allowed_environments: ["production"] });
});

test("active identity configuration uses a signed User Assertion in the sample", async ({
  page,
  request,
}) => {
  await setup(request, { identityConfigured: true });
  await signIn(page, false);
  await page.goto(quickstartPath("ak_01J00000000000000000000000"));

  await page
    .getByRole("tablist", { name: "Sample requests" })
    .getByRole("tab", { name: "Writing Task 2" })
    .click();
  const sample = page.getByRole("tabpanel", { name: "Writing Task 2" });
  await expect(sample).toBeVisible();
  await expect(
    sample.getByText("<user-assertion>", { exact: true })
  ).toBeVisible();
  await expect(
    sample.getByText(/User Assertion có chữ ký.*vô hiệu hóa cấu hình/)
  ).toBeVisible();
  await expect(sample.getByTestId("sample-request-command")).toContainText(
    "USER_IDENTITY='<user-assertion>'"
  );
});

test("rotation reveals a new key once and sends no idempotency key", async ({
  page,
  request,
}) => {
  await setup(request);
  await signIn(page);
  const oldRow = page.getByRole("row", { name: /Production backend/ });
  const oldKeyRow = page.getByRole("row", { name: /aihub_sk_ABC123/ });
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/ak_01J00000000000000000000000/rotate") &&
      response.request().method() === "POST"
  );
  await oldRow.getByRole("button", { name: "Xoay key" }).click();
  const response = await responsePromise;
  expect(response.headers()["cache-control"]).toBe("no-store");
  await expect(page.getByRole("dialog", { name: "API key mới" })).toBeVisible();
  await expect(page.getByTestId("api-key-raw")).toHaveText(
    `aihub_sk_${"B".repeat(43)}`
  );
  const quickstart = await openQuickstartFromDialog(page);
  // The replacement's Quickstart, not the revoked key's not-found.
  await expect(
    quickstart.getByRole("heading", { name: "Production backend · Quickstart" })
  ).toBeVisible();
  await expect(
    quickstart.getByText("aihub_sk_ROTATE", { exact: true })
  ).toBeVisible();
  expect(quickstart.url()).not.toContain("ak_01J00000000000000000000000");
  await quickstart.close();
  await expect(page.getByTestId("api-key-raw")).toBeVisible();
  await expect(oldKeyRow).toHaveCount(0);
  const replacement = page.getByRole("row", { name: /Production backend/ });
  await expect(replacement).toContainText("aihub_sk_ROTATE");
  await expect(replacement).toContainText("writing.grade");
  await expect(replacement).toContainText("Production (tính phí)");
  await expect(replacement).toContainText(/15 thg 11, 2026/);

  const requests = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((result) => result.json());
  const rotation = requests.requests.find(
    (entry: { path: string }) => entry.path === "rotate-api-key"
  );
  expect(rotation.hasIdempotencyKey).toBe(false);
  await page.getByRole("button", { name: "Đóng" }).click();
  await expect(page.getByTestId("api-key-raw")).toHaveCount(0);
  await expect(replacement).toBeVisible();
});

test("the create form offers no Environment and warns every call is billed", async ({
  page,
  request,
}) => {
  await setup(request, { apiKeys: [], entitlements: ["writing", "speaking"] });
  await signIn(page);
  await page.getByText("Tạo API key", { exact: true }).click();

  await expect(page.locator('input[name="environment"]')).toHaveCount(0);
  await expect(page.getByText(/kể cả gọi thử, đều tính/)).toBeVisible();
});

test("closing the create form discards the scopes", async ({
  page,
  request,
}) => {
  await setup(request, { apiKeys: [], entitlements: ["writing", "speaking"] });
  await signIn(page);
  await page.getByText("Tạo API key", { exact: true }).click();
  await page.locator('input[name="scopes"][value="writing.grade"]').check();
  await page.getByRole("button", { name: "Đóng" }).click();

  await page.getByText("Tạo API key", { exact: true }).click();
  await expect(
    page.locator('input[name="scopes"][value="writing.grade"]')
  ).not.toBeChecked();
});

test("rotating a Sandbox key keeps a Sandbox Quickstart", async ({
  page,
  request,
}) => {
  await setup(request, {
    apiKeys: [
      {
        id: "ak_01J00000000000000000000005",
        name: "Sandbox backend",
        key_prefix: "aihub_sk_SANDBX",
        scopes: ["writing.grade"],
        allowed_environments: ["sandbox"],
        status: "active",
        expires_at: null,
        last_used_at: null,
        created_at: "2026-09-20T10:00:00.000Z",
      },
    ],
  });
  await signIn(page);
  const row = page.getByRole("row", { name: /Sandbox backend/ });
  await expect(row).toContainText("Sandbox (miễn phí)");
  await row.getByRole("button", { name: "Xoay key" }).click();

  const quickstart = await openQuickstartFromDialog(page);
  const task1 = quickstart.getByRole("tabpanel", { name: "Writing Task 1" });
  await expect(task1.getByTestId("sample-request-command")).toContainText(
    "sandbox.aihubproduction.com"
  );
  await expect(
    task1.getByText(/miễn phí và không tính vào hạn mức trả phí/)
  ).toBeVisible();
});

test("rotation timeout lists its replacement so it can be rotated again", async ({
  page,
  request,
}) => {
  await setup(request, { rotateKeyUncertainOnce: true });
  await signIn(page);
  await page
    .getByRole("row", { name: /Production backend/ })
    .getByRole("button", { name: "Xoay key" })
    .click();

  await expect(page.getByText(/xoay key replacement/)).toBeVisible();
  const replacement = page.getByRole("row", { name: /aihub_sk_ROTATE/ });
  await expect(replacement).toBeVisible();
  await replacement.getByRole("button", { name: "Xoay key" }).click();
  await expect(page.getByRole("dialog", { name: "API key mới" })).toBeVisible();
});

test("revocation confirms the named key and removes it from the inventory", async ({
  page,
  request,
}) => {
  await setup(request);
  await signIn(page);
  const expiredRow = page.getByRole("row", { name: /Expired staging key/ });
  await expiredRow.getByRole("button", { name: "Thu hồi" }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toContainText("Expired staging key");
  await confirmation.getByRole("button", { name: "Hủy" }).click();
  await expect(expiredRow).toBeVisible();

  await expiredRow.getByRole("button", { name: "Thu hồi" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Xác nhận thu hồi" })
    .click();
  await expect(
    page.getByRole("row", { name: /Expired staging key/ })
  ).toHaveCount(0);
  await expect(page.getByText("Đã thu hồi API key.")).toBeVisible();
});

test("members and suspended Organizations never request the API-key list", async ({
  page,
  request,
}) => {
  await setup(request, { membershipRole: "member" });
  await signIn(page, false);
  await expect(page).toHaveURL(/\/console\/orgs\/org-keys-12345678$/);
  await page.goto("/console/orgs/org-keys-12345678/api-keys");
  await expect(page).toHaveURL(/\/console\/orgs\/denied$/);

  await setup(request, {
    membershipRole: "owner",
    organizationStatus: "suspended",
  });
  await signIn(page, false);
  await expect(page).toHaveURL(/\/console\/orgs\/org-keys-12345678$/);
  await page.goto("/console/orgs/org-keys-12345678/api-keys");
  await expect(page).toHaveURL(/\/console\/orgs\/denied$/);
  const requests = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((result) => result.json());
  expect(
    requests.requests.filter(
      (entry: { path: string }) => entry.path === "list-api-keys"
    )
  ).toHaveLength(0);
});

test("a key's Quickstart lists its Sample requests without its raw key", async ({
  page,
  request,
}) => {
  await setup(request);
  await signIn(page);
  await page
    .getByRole("row", { name: /Production backend/ })
    .getByRole("link", { name: "Gọi thử" })
    .click();

  await expect(page).toHaveURL(
    /\/console\/orgs\/org-keys-12345678\/api-keys\/ak_01J00000000000000000000000\/quickstart$/
  );
  await expect(
    page.getByRole("heading", { name: "Production backend · Quickstart" })
  ).toBeVisible();
  await expect(
    page.getByText("aihub_sk_ABC123", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Sample requests" }).getByRole("tab")
  ).toHaveText(["Writing Task 1", "Writing Task 2"]);
  const task1 = page.getByRole("tabpanel", { name: "Writing Task 1" });
  await expect(task1.getByTestId("sample-request-command")).toContainText(
    `API_KEY="\${API_KEY:?Chạy export API_KEY=<API key của bạn> trước}"`
  );
  await expect(task1.getByTestId("sample-request-command")).toContainText(
    "https://api.aihubproduction.com/v1/ielts/writing/task1/grade"
  );

  await page.getByRole("link", { name: "← API keys" }).click();
  await expect(page).toHaveURL(/\/console\/orgs\/org-keys-12345678\/api-keys$/);
});

const quickstartKeys = [
  {
    id: "ak_01J00000000000000000000000",
    name: "Production backend",
    key_prefix: "aihub_sk_ABC123",
    scopes: ["writing.grade"],
    allowed_environments: ["production"],
    status: "active",
    expires_at: null,
    last_used_at: null,
    created_at: "2026-09-20T10:00:00.000Z",
  },
  {
    id: "ak_01J00000000000000000000001",
    name: "Expired writing key",
    key_prefix: "aihub_sk_DEF456",
    scopes: ["writing.grade"],
    allowed_environments: ["production"],
    status: "expired",
    expires_at: "2026-09-21T10:00:00.000Z",
    last_used_at: null,
    created_at: "2026-08-20T10:00:00.000Z",
  },
  {
    id: "ak_01J00000000000000000000004",
    name: "Unknown scope key",
    key_prefix: "aihub_sk_UNKNWN",
    scopes: ["speech.toText"],
    allowed_environments: ["production"],
    status: "active",
    expires_at: null,
    last_used_at: null,
    created_at: "2026-09-20T10:00:00.000Z",
  },
  {
    id: "ak_01J00000000000000000000003",
    name: "Staging backend",
    key_prefix: "aihub_sk_STAGE1",
    scopes: ["writing.grade"],
    allowed_environments: ["staging"],
    status: "active",
    expires_at: null,
    last_used_at: null,
    created_at: "2026-09-20T10:00:00.000Z",
  },
  {
    id: "ak_01J00000000000000000000009",
    name: "Revoked backend",
    key_prefix: "aihub_sk_REVOKD",
    scopes: ["writing.grade"],
    allowed_environments: ["production"],
    status: "revoked",
    expires_at: null,
    last_used_at: null,
    created_at: "2026-09-20T10:00:00.000Z",
  },
];

function quickstartPath(apiKeyId: string) {
  return `/console/orgs/org-keys-12345678/api-keys/${apiKeyId}/quickstart`;
}

test("only an active key with a Sample request offers a Quickstart", async ({
  page,
  request,
}) => {
  await setup(request, { apiKeys: quickstartKeys });
  await signIn(page);

  const table = page.getByRole("table", { name: "API keys" });
  await expect(table.getByRole("link", { name: "Gọi thử" })).toHaveCount(2);
  for (const name of ["Production backend", "Staging backend"])
    await expect(
      table
        .getByRole("row", { name: new RegExp(name) })
        .getByRole("link", { name: "Gọi thử" })
    ).toBeVisible();

  for (const apiKeyId of [
    "ak_01J00000000000000000000001", // expired
    "ak_01J00000000000000000000004", // no Sample request
    "ak_01J00000000000000000000009", // revoked
    "ak_01J0000000000000000000ZZZZ", // unknown, or another Organization's
  ]) {
    const response = await page.goto(quickstartPath(apiKeyId));
    expect(response?.status(), apiKeyId).toBe(404);
    await expect(page.getByTestId("sample-request-command")).toHaveCount(0);
  }
});

test("an unreadable key inventory is not mistaken for a missing key", async ({
  page,
  request,
}) => {
  await setup(request, {
    apiKeys: quickstartKeys,
    apiKeyListUnavailable: true,
  });
  await signIn(page, false);

  const response = await page.goto(
    quickstartPath("ak_01J00000000000000000000000")
  );
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Không thể tải API keys" })
  ).toBeVisible();
  await expect(page.getByTestId("sample-request-command")).toHaveCount(0);
});

test("members and suspended Organizations are denied a Quickstart", async ({
  page,
  request,
}) => {
  for (const options of [
    { membershipRole: "member" },
    { membershipRole: "owner", organizationStatus: "suspended" },
  ]) {
    await setup(request, { ...options, apiKeys: quickstartKeys });
    await signIn(page, false);
    await page.goto(quickstartPath("ak_01J00000000000000000000000"));
    await expect(page).toHaveURL(/\/console\/orgs\/denied$/);
  }
  const requests = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((result) => result.json());
  expect(
    requests.requests.filter(
      (entry: { path: string }) => entry.path === "list-api-keys"
    )
  ).toHaveLength(0);
});

test("a Sandbox key's Quickstart targets the Sandbox host", async ({
  page,
  request,
}) => {
  await setup(request, {
    apiKeys: [
      {
        ...quickstartKeys[0],
        name: "Sandbox backend",
        allowed_environments: ["sandbox"],
      },
    ],
  });
  await signIn(page, false);
  await page.goto(quickstartPath("ak_01J00000000000000000000000"));

  await expect(page.getByText("Sandbox (miễn phí)")).toBeVisible();
  const task1 = page.getByRole("tabpanel", { name: "Writing Task 1" });
  await expect(task1.getByTestId("sample-request-command")).toContainText(
    "https://sandbox.aihubproduction.com/v1/ielts/writing/task1/grade"
  );
  await expect(task1.getByText(/25 lần chấm mỗi tháng/)).toBeVisible();
});

test("a staging-only key's Quickstart explains there is no host to call", async ({
  page,
  request,
}) => {
  await setup(request, { apiKeys: quickstartKeys });
  await signIn(page);
  await page
    .getByRole("row", { name: /Staging backend/ })
    .getByRole("link", { name: "Gọi thử" })
    .click();

  const task1 = page.getByRole("tabpanel", { name: "Writing Task 1" });
  await expect(
    task1.getByText(/AIHUB chưa có staging host công khai/)
  ).toBeVisible();
  await expect(page.getByTestId("sample-request-command")).toHaveCount(0);
  await expect(page.getByText(/tính vào hạn mức sử dụng/)).toHaveCount(0);
});

test("a Quickstart fits a phone without horizontal page scroll", async ({
  page,
  request,
}) => {
  await setup(request, { apiKeys: quickstartKeys });
  await signIn(page, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(quickstartPath("ak_01J00000000000000000000000"));

  await expect(page.getByTestId("sample-request-command")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a Quickstart offers the same request for PowerShell", async ({
  page,
  request,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await setup(request, { apiKeys: quickstartKeys });
  await signIn(page, false);
  await page.goto(quickstartPath("ak_01J00000000000000000000000"));

  const command = page.getByTestId("sample-request-command");
  await expect(command).toContainText("curl --request POST");
  await page.getByRole("button", { name: "PowerShell" }).click();
  await expect(
    page.getByRole("button", { name: "PowerShell" })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(command).toContainText("curl.exe --request POST");
  await expect(command).toContainText("$env:API_KEY");
  await expect(command).not.toContainText("<<'JSON'");

  await page.getByRole("button", { name: "Sao chép lệnh" }).click();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain("curl.exe --request POST");

  // The shell is the holder's, not the request's: it survives a tab change.
  await page
    .getByRole("tablist", { name: "Sample requests" })
    .getByRole("tab", { name: "Writing Task 2" })
    .click();
  await expect(command).toContainText("curl.exe --request POST");
  await expect(command).toContainText("task2/grade");
});

test("a raw key pasted into the Quickstart makes its commands run as pasted", async ({
  page,
  request,
}) => {
  const rawKey = `aihub_sk_ABC123${"k".repeat(37)}`;
  await setup(request, { apiKeys: quickstartKeys });
  await signIn(page, false);
  await page.goto(quickstartPath("ak_01J00000000000000000000000"));

  const field = page.getByLabel("API key của bạn");
  const command = page.getByTestId("sample-request-command");
  await field.fill(`aihub_sk_ZZZZZZ${"k".repeat(37)}`);
  await expect(
    page.getByText(/không phải raw key của Production backend/)
  ).toBeVisible();
  await expect(command).toContainText("${API_KEY:?");

  await field.fill(`  ${rawKey}\n`);
  await expect(command).toContainText(`API_KEY='${rawKey}'`);
  await expect(page.getByText(/Lệnh đã chứa API key/)).toBeVisible();
  await page.getByRole("button", { name: "PowerShell" }).click();
  await expect(command).toContainText(`$apiKey = '${rawKey}'`);

  // The key stays in this tab's memory: not in the URL, not in storage.
  expect(page.url()).not.toContain(rawKey);
  const storage = await page.evaluate(() =>
    JSON.stringify({ local: localStorage, session: sessionStorage })
  );
  expect(storage).not.toContain(rawKey);
  await page.reload();
  await expect(page.getByLabel("API key của bạn")).toHaveValue("");
  await expect(command).not.toContainText(rawKey);
});

test("the reveal dialog copies a command that runs as pasted", async ({
  page,
  request,
}) => {
  let requestContainsRawKey = false;
  let rawKey = "";
  page.on("request", (browserRequest) => {
    if (
      rawKey &&
      `${browserRequest.url()}\n${browserRequest.postData() ?? ""}`.includes(
        rawKey
      )
    )
      requestContainsRawKey = true;
  });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await setup(request, { apiKeys: [] });
  await signIn(page);
  await page.getByText("Tạo API key", { exact: true }).click();
  await page.getByLabel("Tên API key").fill("One step key");
  await page.locator('input[name="scopes"][value="writing.grade"]').check();
  await page.getByRole("button", { name: "Tạo key" }).click();

  const dialog = page.getByRole("dialog", { name: "API key mới" });
  rawKey = (await page.getByTestId("api-key-raw").textContent()) ?? "";
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());

  await dialog
    .getByRole("button", { name: "Sao chép lệnh Writing Task 2" })
    .click();
  const bash = await clipboard();
  expect(bash.split(/\r?\n/)[0]).toBe(`API_KEY='${rawKey}'`);
  expect(bash).toContain(
    "https://api.aihubproduction.com/v1/ielts/writing/task2/grade"
  );

  await dialog.getByRole("button", { name: "PowerShell" }).click();
  await dialog
    .getByRole("button", { name: "Sao chép lệnh Writing Task 1" })
    .click();
  const powershell = await clipboard();
  expect(powershell).toContain(`$apiKey = '${rawKey}'`);
  expect(powershell).toContain("curl.exe --request POST");

  // Copied, never shown: the dialog renders no command, and nothing is sent.
  await expect(dialog.getByTestId("sample-request-command")).toHaveCount(0);
  await expect(dialog.getByText(/Lệnh đã chứa API key/)).toBeVisible();
  expect(requestContainsRawKey).toBe(false);
});

test("a Quickstart offers the request as a curl Postman can import", async ({
  page,
  request,
}) => {
  await setup(request, { apiKeys: quickstartKeys });
  await signIn(page, false);
  await page.goto(quickstartPath("ak_01J00000000000000000000000"));

  const command = page.getByTestId("sample-request-command");
  await page.getByRole("button", { name: "Postman" }).click();
  await expect(command).toContainText(
    "curl --request POST 'https://api.aihubproduction.com/v1/ielts/writing/task1/grade'"
  );
  await expect(command).toContainText("--header 'X-API-Key: {{API_KEY}}'");
  await expect(command).toContainText("--data-raw '{");
  await expect(page.getByText(/Import › Raw text/)).toBeVisible();
  await expect(page.getByText(/Tạo biến API_KEY/)).toBeVisible();

  const rawKey = `aihub_sk_ABC123${"k".repeat(37)}`;
  await page.getByLabel("API key của bạn").fill(rawKey);
  await expect(command).toContainText(`--header 'X-API-Key: ${rawKey}'`);
  await expect(page.getByText(/Tạo biến API_KEY/)).toHaveCount(0);
});
