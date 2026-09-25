import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const mockUrl = "http://127.0.0.1:3101";
const password = "correct horse battery staple";

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
          organization: {
            id: "org-keys-12345678",
            name: "API Keys Org",
            status: organizationStatus,
            entitlements,
          },
          membership_role: membershipRole,
        },
      ],
      apiKeys,
      ...mockOptions,
    },
  });
}

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill("valid@example.test");
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

test("owner sees active and expired API keys with their metadata", async ({
  page,
  request,
}) => {
  await setup(request);
  await signIn(page);

  await expect(page).toHaveURL(/\/console\/orgs\/org-keys-12345678\/api-keys$/);
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
  await expect(page.getByRole("status")).toContainText("Chưa có API key");

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
  const directAihubRequests: string[] = [];
  page.on("request", (browserRequest) => {
    if (new URL(browserRequest.url()).origin === mockUrl)
      directAihubRequests.push(browserRequest.url());
  });
  await setup(request, { apiKeys: [] });
  await signIn(page);
  await page.getByText("Tạo API key", { exact: true }).click();

  const writing = page.locator('input[name="scopes"][value="writing.grade"]');
  const speaking = page.locator('input[name="scopes"][value="speaking.grade"]');
  await expect(writing).not.toBeChecked();
  await expect(speaking).toBeDisabled();
  await expect(
    page.getByText(/Speaking — không khả dụng, liên hệ AIHUB/)
  ).toBeVisible();
  await expect(
    page.locator('input[name="allowed_environments"][value="production"]')
  ).toBeChecked();

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
  await expect(
    page.getByRole("row", { name: /New service key/ })
  ).toBeVisible();

  const requests = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((result) => result.json());
  expect(JSON.stringify(requests)).not.toContain(rawKey);
  expect(directAihubRequests).toEqual([]);
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
  expect(
    requests.requests.filter(
      (entry: { path: string }) => entry.path === "create-api-key"
    )
  ).toHaveLength(1);
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
  await expect(oldKeyRow).toHaveCount(0);
  const replacement = page.getByRole("row", { name: /Production backend/ });
  await expect(replacement).toContainText("aihub_sk_ROTATE");
  await expect(replacement).toContainText("writing.grade");
  await expect(replacement).toContainText("production");
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
  await expect(page.getByRole("status")).toContainText("Đã thu hồi API key");
});

test("members and suspended Organizations never request the API-key list", async ({
  page,
  request,
}) => {
  await setup(request, { membershipRole: "member" });
  await signIn(page);
  await expect(page).toHaveURL(/\/console\/orgs\/org-keys-12345678$/);
  await page.goto("/console/orgs/org-keys-12345678/api-keys");
  await expect(page).toHaveURL(/\/console\/orgs\/denied$/);

  await setup(request, {
    membershipRole: "owner",
    organizationStatus: "suspended",
  });
  await signIn(page);
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
