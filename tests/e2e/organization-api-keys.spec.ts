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

/** The reveal dialog opens on the first request; Task 2 is not first. */
async function showWritingTask2(page: Page) {
  await page
    .getByRole("tablist", { name: "Sample requests" })
    .getByRole("tab", { name: "Writing Task 2" })
    .click();
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
  await showWritingTask2(page);
  const sample = dialog.getByRole("tabpanel", { name: "Writing Task 2" });
  await expect(sample).toBeVisible();
  await expect(sample.getByText("test-user-1", { exact: true })).toBeVisible();
  const headers = sample.getByRole("table", {
    name: "Writing Task 2 request headers",
  });
  const apiKeyHeader = headers.getByRole("row", { name: /X-API-Key/ });
  await expect(apiKeyHeader).toContainText("aihub_sk_ABC123…");
  await expect(apiKeyHeader).not.toContainText(rawKey ?? "");
  const idempotencyKey = await headers
    .getByRole("row", { name: /Idempotency-Key/ })
    .locator("td")
    .first()
    .textContent();
  expect(idempotencyKey).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
  const command = await sample
    .getByTestId("sample-request-command")
    .textContent();
  expect(command).toContain(rawKey);
  expect(command).toContain(`IDEMPOTENCY_KEY='${idempotencyKey}'`);
  await expect(sample.getByText(/tính vào hạn mức sử dụng/)).toBeVisible();
  const requestsBeforeCopy = apiRequestCount;
  await sample.getByRole("button", { name: "Sao chép lệnh" }).click();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard.replaceAll("\r\n", "\n")).toBe(
    command?.replaceAll("\r\n", "\n")
  );
  expect(apiRequestCount).toBe(requestsBeforeCopy);
  expect(requestContainsRawKey).toBe(false);
  await expect(
    page.getByRole("row", { name: /New service key/ })
  ).toBeVisible();

  const requests = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((result) => result.json());
  expect(JSON.stringify(requests)).not.toContain(rawKey);
  await page.getByRole("button", { name: "Đóng" }).click();
  await expect(page.getByTestId("sample-request-command")).toHaveCount(0);
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
  // The dialog reopens on the first request, which is now Task 1.
  await expect(
    page.getByRole("tabpanel", { name: "Writing Task 1" })
  ).toBeVisible();
  const rotatedCommand = await page
    .getByTestId("sample-request-command")
    .textContent();
  expect(rotatedCommand).toContain("task1/grade");
  expect(rotatedCommand).toContain(rotatedRawKey);
  expect(rotatedCommand).not.toContain(rawKey);
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
    .getByRole("button", { name: "Xoay key" })
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
  await expect(task1.getByText(/URL giữ chỗ/)).toBeVisible();
  await expect(task1.getByText(/thay bằng/)).toBeVisible();
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
  await expect(task2.getByText(/URL giữ chỗ/)).toHaveCount(0);
});

test("a key holding both scopes shows one tab per request, Writing first", async ({
  page,
  request,
}) => {
  await setup(request, { apiKeys: [], entitlements: ["writing", "speaking"] });
  await signIn(page);
  await page.getByText("Tạo API key", { exact: true }).click();
  await page.getByLabel("Tên API key").fill("Both scopes key");
  await page.locator('input[name="scopes"][value="writing.grade"]').check();
  await page.locator('input[name="scopes"][value="speaking.grade"]').check();
  await page.getByRole("button", { name: "Tạo key" }).click();

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
    const nodes = Array.from(panel.children);
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
      "https://api.aihubproduction.com/v1/ielts/speaking/grading",
      { exact: true }
    )
  ).toBeVisible();

  const headers = speaking.getByRole("table", {
    name: "Speaking request headers",
  });
  await expect(
    headers.getByRole("row", { name: /Idempotency-Key/ })
  ).toHaveCount(0);
  await expect(headers.getByRole("row", { name: /Content-Type/ })).toHaveCount(
    0
  );
  await expect(speaking.getByText(/chưa hỗ trợ Idempotency-Key/)).toBeVisible();
  await expect(speaking.getByText(/chấm bài và tính phí/)).toBeVisible();
  await expect(speaking.getByText(/curl tự sinh Content-Type/)).toBeVisible();

  const command = await speaking
    .getByTestId("sample-request-command")
    .innerText();
  expect(command).toContain("AUDIO_FILE='./answer.wav'");
  expect(command).toContain('-F "audio=@${AUDIO_FILE}"');
  expect(command).not.toContain("Content-Type");
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
    .getByRole("button", { name: "Xoay key" })
    .click();

  const tablist = page.getByRole("tablist", { name: "Sample requests" });
  await expect(tablist.getByRole("tab")).toHaveText(["Speaking"]);
  const speaking = page.getByRole("tabpanel", { name: "Speaking" });
  await expect(speaking).toBeVisible();
  await expect(
    speaking.getByRole("table", { name: "Speaking request body" })
  ).toContainText("question_id");
});

test("a key with no scope that has a known endpoint shows no Sample request", async ({
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
  await expect(page.getByText("Gọi thử", { exact: true })).toHaveCount(0);
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
  await setup(request, { apiKeys: [], identityConfigured: true });
  await signIn(page);
  await page.getByText("Tạo API key", { exact: true }).click();
  await page.getByLabel("Tên API key").fill("Signed identity key");
  await page.locator('input[name="scopes"][value="writing.grade"]').check();
  await page.getByRole("button", { name: "Tạo key" }).click();

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
  await showWritingTask2(page);
  const sample = page.getByRole("tabpanel", { name: "Writing Task 2" });
  await expect(sample).toBeVisible();
  const headers = sample.getByRole("table", {
    name: "Writing Task 2 request headers",
  });
  await expect(
    headers.getByRole("row", { name: /X-User-Identity/ })
  ).toContainText("test-user-1");
  await expect(sample.getByTestId("sample-request-command")).toContainText(
    `aihub_sk_${"B".repeat(43)}`
  );
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

test("staging-only rotation shows a note instead of a command", async ({
  page,
  request,
}) => {
  await setup(request, {
    apiKeys: [
      {
        id: "ak_01J00000000000000000000002",
        name: "Staging backend",
        key_prefix: "aihub_sk_STAGING",
        scopes: ["writing.grade"],
        allowed_environments: ["staging"],
        status: "active",
        expires_at: null,
        last_used_at: null,
        created_at: "2026-09-20T10:00:00.000Z",
      },
    ],
  });
  await signIn(page);
  await page
    .getByRole("row", { name: /Staging backend/ })
    .getByRole("button", { name: "Xoay key" })
    .click();

  await showWritingTask2(page);
  await expect(
    page.getByRole("tabpanel", { name: "Writing Task 2" })
  ).toBeVisible();
  await expect(
    page.getByText(/AIHUB chưa có staging host công khai/)
  ).toBeVisible();
  await expect(page.getByTestId("sample-request-command")).toHaveCount(0);
  // A key with no runnable command must not be warned about a cost.
  await expect(page.getByText(/tính vào hạn mức sử dụng/)).toHaveCount(0);
});

test("creating a Sandbox key restricts the scopes and targets the Sandbox host", async ({
  page,
  request,
}) => {
  await setup(request, { apiKeys: [], entitlements: ["writing", "speaking"] });
  await signIn(page);
  await page.getByText("Tạo API key", { exact: true }).click();

  const speaking = page.locator('input[name="scopes"][value="speaking.grade"]');
  await speaking.check();
  await page.locator('input[name="environment"][value="sandbox"]').check();

  await expect(speaking).toBeDisabled();
  await expect(speaking).not.toBeChecked();
  await expect(
    page.getByText(/Sandbox key chỉ chạy được Writing/)
  ).toBeVisible();
  await expect(
    page.getByText(/miễn phí và không tính vào hạn mức trả phí/)
  ).toBeVisible();

  await page.getByLabel("Tên API key").fill("Sandbox test key");
  await page.locator('input[name="scopes"][value="writing.grade"]').check();
  await page.getByRole("button", { name: "Tạo key" }).click();

  const dialog = page.getByRole("dialog", { name: "API key mới" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("tablist", { name: "Sample requests" }).getByRole("tab")
  ).toHaveText(["Writing Task 1", "Writing Task 2"]);

  const sandboxTask1 = dialog.getByRole("tabpanel", { name: "Writing Task 1" });
  await expect(sandboxTask1).toBeVisible();
  await expect(
    sandboxTask1.getByText(
      "https://sandbox.aihubproduction.com/v1/ielts/writing/task1/grade",
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    sandboxTask1.getByTestId("sample-request-command")
  ).toContainText("sandbox.aihubproduction.com");
  await expect(
    sandboxTask1.getByText(/miễn phí và không tính vào hạn mức trả phí/)
  ).toBeVisible();

  await showWritingTask2(page);
  const sample = dialog.getByRole("tabpanel", { name: "Writing Task 2" });
  await expect(sample).toBeVisible();
  await expect(
    sample.getByText(
      "https://sandbox.aihubproduction.com/v1/ielts/writing/task2/grade",
      { exact: true }
    )
  ).toBeVisible();
  await expect(sample.getByTestId("sample-request-command")).toContainText(
    "sandbox.aihubproduction.com"
  );
  await expect(sample.getByText(/25 lần chấm mỗi tháng/)).toBeVisible();
  await expect(
    sample.getByText(/tính theo Organization, không tính theo key/)
  ).toBeVisible();

  const requests = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((result) => result.json());
  expect(
    requests.requests.find(
      (entry: { path: string }) => entry.path === "create-api-key"
    )
  ).toMatchObject({
    allowed_environments: ["sandbox"],
    scopes: ["writing.grade"],
  });
});

test("closing the create form discards the Environment and the scopes", async ({
  page,
  request,
}) => {
  await setup(request, { apiKeys: [], entitlements: ["writing", "speaking"] });
  await signIn(page);
  await page.getByText("Tạo API key", { exact: true }).click();
  await page.locator('input[name="environment"][value="sandbox"]').check();
  await page.locator('input[name="scopes"][value="writing.grade"]').check();
  await page.getByRole("button", { name: "Đóng" }).click();

  await page.getByText("Tạo API key", { exact: true }).click();
  await expect(
    page.locator('input[name="environment"][value="production"]')
  ).toBeChecked();
  await expect(
    page.locator('input[name="scopes"][value="writing.grade"]')
  ).not.toBeChecked();
  await expect(
    page.locator('input[name="scopes"][value="speaking.grade"]')
  ).toBeEnabled();
});

test("rotating a Sandbox key keeps the Sandbox Sample request", async ({
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

  await showWritingTask2(page);
  const sample = page.getByRole("tabpanel", { name: "Writing Task 2" });
  await expect(sample).toBeVisible();
  await expect(sample.getByTestId("sample-request-command")).toContainText(
    "sandbox.aihubproduction.com"
  );
  await expect(
    sample.getByText(/miễn phí và không tính vào hạn mức trả phí/)
  ).toBeVisible();
  const task1 = page.getByRole("tabpanel", { name: "Writing Task 1" });
  await expect(task1).toHaveCount(0);
  await page
    .getByRole("tablist", { name: "Sample requests" })
    .getByRole("tab", { name: "Writing Task 1" })
    .click();
  await expect(task1.getByTestId("sample-request-command")).toContainText(
    "sandbox.aihubproduction.com"
  );
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
