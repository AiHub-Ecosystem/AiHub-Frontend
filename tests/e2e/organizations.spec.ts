import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const mockUrl = "http://127.0.0.1:3101";
const password = "correct horse battery staple";
const disabledIdentityCopy =
  "AIHUB đã tạm vô hiệu hóa identity configuration này. Organization hiện dùng Declared User ID, nghĩa là bất kỳ ai có API key của Organization đều có thể gửi yêu cầu dưới ID của bất kỳ người dùng nào mà không cần chữ ký. Lưu không khôi phục xác minh chữ ký; chỉ AIHUB có thể kích hoạt lại.";
type RosterItem = {
  organization_id: string;
  name: string;
  status: string;
  entitlements: string[];
  membership: { role: string };
  members: { username: string; role: string }[];
  identity_configured?: boolean;
};

async function setup(
  request: APIRequestContext,
  roster: RosterItem[] = [],
  options = {}
) {
  await request.post(`${mockUrl}/__test__/auth/reset`);
  await request.post(`${mockUrl}/__test__/organizations/config`, {
    data: { roster, ...options },
  });
}

async function identityConfigPuts(request: APIRequestContext) {
  const result = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((response) => response.json());
  return result.requests.filter(
    (entry: { method: string; path: string }) =>
      entry.method === "PUT" && entry.path === "identity-config"
  );
}

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  await expect(page.getByLabel("Email")).toBeVisible();
  await page.getByLabel("Email").fill("valid@example.test");
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

const org = (
  id: string,
  name: string,
  role = "owner",
  status = "active"
): RosterItem => ({
  organization_id: id,
  name,
  status,
  entitlements: ["writing"],
  identity_configured: false,
  membership: { role },
  members: [{ username: "owner", role }],
});

test("an empty roster routes to the organizations list", async ({
  page,
  request,
}) => {
  await setup(request);
  await signIn(page);
  await expect(page).toHaveURL(/\/console\/orgs$/);
  await expect(
    page.getByRole("heading", { name: "Organizations" })
  ).toBeVisible();
});

test("an owner can configure identity and manage API keys", async ({
  page,
  request,
}) => {
  const ownerOrg = org("owner-id", "Owner Org");
  delete ownerOrg.identity_configured;
  await setup(request, [ownerOrg]);
  await signIn(page);
  await expect(page).toHaveURL(/\/console\/orgs\/owner-id$/);
  await expect(page.getByRole("heading", { name: "Owner Org" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cấu hình identity" })
  ).toBeVisible();
  await expect(page.getByText("Identity setup chưa hoàn tất")).toHaveCount(0);
  await page.getByRole("button", { name: "Cấu hình identity" }).click();
  const identityDialog = page.getByRole("dialog");
  await expect(identityDialog).toBeVisible();
  await expect(
    identityDialog.getByRole("textbox", { name: "JWKS URL" })
  ).toBeVisible();
  await expect(
    identityDialog.getByRole("link", { name: "Quản lý API keys" })
  ).toBeVisible();
  await identityDialog.getByRole("button", { name: "Đóng" }).click();
  await page.getByRole("link", { name: "Quản lý API keys" }).click();
  await expect(page).toHaveURL(/\/console\/orgs\/owner-id\/api-keys$/);
  await expect(
    page.getByRole("heading", { name: "Owner Org · API keys" })
  ).toBeVisible();
});

test("an admin can open the API-key inventory", async ({ page, request }) => {
  await setup(request, [org("admin-id", "Admin Org", "admin")]);
  await signIn(page);
  await expect(page).toHaveURL(/\/console\/orgs\/admin-id$/);
  await expect(page.getByRole("heading", { name: "Admin Org" })).toBeVisible();
  await page.getByRole("link", { name: "Quản lý API keys" }).click();
  await expect(page).toHaveURL(/\/console\/orgs\/admin-id\/api-keys$/);
});

test("a member sees the roster without owner actions", async ({
  page,
  request,
}) => {
  await setup(request, [org("member-id", "Member Org", "member")]);
  await signIn(page);
  await expect(page).toHaveURL(/\/console\/orgs\/member-id$/);
  await expect(page.getByText("Membership Role: member")).toBeVisible();
  await expect(page.getByRole("button", { name: "Lưu tên mới" })).toHaveCount(
    0
  );
});

test("a suspended organization shows its status", async ({ page, request }) => {
  await setup(request, [
    org("suspended-id", "Paused Org", "owner", "suspended"),
  ]);
  await signIn(page);
  await expect(page).toHaveURL(/\/console\/orgs\/suspended-id$/);
  await expect(page.getByRole("status")).toContainText("tạm ngưng");
});

test("multiple organizations show role, status, and short IDs for duplicate names", async ({
  page,
  request,
}) => {
  await setup(request, [
    org("org-12345678", "Same name"),
    org("org-98765432", "Same name", "member"),
  ]);
  await signIn(page);
  await expect(page).toHaveURL(/\/console\/orgs$/);
  const organizations = page.getByRole("list", { name: "Organizations" });
  await expect(organizations.getByText("owner")).toBeVisible();
  await expect(organizations.getByText("member")).toBeVisible();
  await expect(
    organizations.getByText("12345678", { exact: true })
  ).toBeVisible();
  await expect(
    organizations.getByText("98765432", { exact: true })
  ).toBeVisible();
  await organizations.getByRole("link", { name: /Same name.*member/ }).click();
  await expect(page).toHaveURL(/\/console\/orgs\/org-98765432$/);
});

test("roster failure stays retryable and does not open the create form", async ({
  page,
  request,
}) => {
  await setup(request, [], { unavailable: true });
  await signIn(page);
  await expect(page.getByRole("alert")).toContainText(
    "Không thể tải Organization"
  );
  await expect(page.getByRole("link", { name: "Thử lại" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tạo Organization" })
  ).toHaveCount(0);
});

test("safe same-origin next wins while an external next is ignored", async ({
  page,
  request,
}) => {
  await setup(request, [org("one", "One Org")]);
  await page.context().clearCookies();
  await page.goto("/login?next=%2Fpricing");
  await page.getByLabel("Email").fill("valid@example.test");
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/pricing$/);

  await setup(request, [org("one", "One Org")]);
  await page.context().clearCookies();
  await page.goto("/login?next=https%3A%2F%2Fattacker.test%2Fcollect");
  await page.getByLabel("Email").fill("valid@example.test");
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/console\/orgs\/one$/);
});

test("create uses server BFF and ignores a double click", async ({
  page,
  request,
}) => {
  await setup(request);
  await signIn(page);
  await page.getByRole("button", { name: "Tạo Organization" }).click();
  await page.getByLabel("Tên Organization").fill("  New Org  ");
  const submit = page
    .locator("form.auth-form")
    .getByRole("button", { name: "Tạo Organization" });
  await submit.dblclick();
  await expect(page).toHaveURL(
    /\/console\/orgs\/org-created-12345678\?identity=open&onboarding=1$/
  );
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("link", { name: /Thiết lập sau/ }).click();
  await expect(page).toHaveURL(
    /\/console\/orgs\/org-created-12345678\/api-keys$/
  );
  const log = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((r) => r.json());
  expect(
    log.requests.filter((entry: { path: string }) => entry.path === "create")
  ).toHaveLength(1);
});

test("uncertain Organization creation can be retried safely", async ({
  page,
  request,
}) => {
  await setup(request, [], { createUncertainOnce: true });
  await signIn(page);
  await page.getByRole("button", { name: "Tạo Organization" }).click();
  await page.getByLabel("Tên Organization").fill("Retry Org");
  await page
    .locator("form.auth-form")
    .getByRole("button", { name: "Tạo Organization" })
    .click();
  await expect(page.locator("form.auth-form").getByRole("alert")).toContainText(
    "thử lại an toàn"
  );
  await page
    .locator("form.auth-form")
    .getByRole("button", { name: "Tạo Organization" })
    .click();
  await expect(page).toHaveURL(
    /\/console\/orgs\/org-created-12345678\?identity=open&onboarding=1$/
  );
  const state = await request
    .get(`${mockUrl}/__test__/organizations/state`)
    .then((r) => r.json());
  expect(state.organizations).toHaveLength(1);
});

test("owner can save a JWKS URL and the readiness reminder clears", async ({
  page,
  request,
}) => {
  await setup(request, [org("identity-url", "Identity Org")]);
  await signIn(page);
  await page.goto("/console/orgs/identity-url/identity");
  await page.getByLabel("Issuer").fill("https://id.example.test");
  await page
    .getByRole("textbox", { name: "JWKS URL" })
    .fill("https://id.example.test/keys");
  await page
    .getByRole("button", { name: "Lưu identity configuration" })
    .click();
  await expect(page.locator(".identity-form [role=status]")).toContainText(
    "Đã lưu identity configuration"
  );
  await page.goto("/console/orgs/identity-url");
  await expect(page.getByText("Identity setup chưa hoàn tất")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Cấu hình identity" })
  ).toBeVisible();
  const requests = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((r) => r.json());
  expect(
    requests.requests.find(
      (item: { path: string; method?: string }) =>
        item.path === "identity-config" && item.method === "PUT"
    )
  ).toBeTruthy();
});

test("saving identity during onboarding proceeds directly to API keys", async ({
  page,
  request,
}) => {
  await setup(request);
  await signIn(page);
  await page.getByRole("button", { name: "Tạo Organization" }).click();
  await page.getByLabel("Tên Organization").fill("Setup during onboarding");
  await page
    .locator("form.auth-form")
    .getByRole("button", { name: "Tạo Organization" })
    .click();
  await expect(page).toHaveURL(
    /\/org-created-12345678\?identity=open&onboarding=1$/
  );
  await page.getByLabel("Issuer").fill("https://onboard.example.test");
  await page
    .getByRole("textbox", { name: "JWKS URL" })
    .fill("https://onboard.example.test/keys");
  await page
    .getByRole("button", { name: "Lưu identity configuration" })
    .click();
  await expect(page).toHaveURL(
    /\/console\/orgs\/org-created-12345678\/api-keys$/
  );
});

test("owner can use inline public JWKS and private JWK is blocked before request", async ({
  page,
  request,
}) => {
  await setup(request, [
    org("identity-inline", "Identity Inline", "owner", "active"),
  ]);
  await signIn(page);
  await page.goto("/console/orgs/identity-inline/identity");
  await page.getByRole("radio", { name: "Dán public JWKS" }).check();
  await page.getByLabel("Issuer").fill("https://inline.example.test");
  const input = page.getByLabel("Public JWKS (JSON)");
  await input.fill(
    JSON.stringify({
      keys: [{ kty: "RSA", kid: "public-1", n: "AQAB", e: "AQAB" }],
    })
  );
  await page
    .getByRole("button", { name: "Lưu identity configuration" })
    .click();
  await expect(page.getByRole("status")).toContainText("Đã lưu");
  await input.fill(JSON.stringify({ keys: [{ kty: "RSA", d: "private" }] }));
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.locator(".identity-form [role=alert]")).toContainText(
    "Không gửi private JWK"
  );
  const requests = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((r) => r.json());
  expect(
    requests.requests.filter(
      (item: { path: string; method: string }) =>
        item.path === "identity-config" && item.method === "PUT"
    )
  ).toHaveLength(1);

  const session = (await page.context().cookies()).find(
    (cookie) => cookie.name === "__Host-aihub_web_session"
  );
  const privateJwkResponse = await request.put(
    `${new URL(page.url()).origin}/api/organizations/identity-inline/identity-config`,
    {
      headers: {
        Origin: new URL(page.url()).origin,
        Cookie: `${session!.name}=${session!.value}`,
      },
      data: {
        issuer: "https://inline.example.test",
        public_keys_jwks: { keys: [{ kty: "RSA", d: "must-not-forward" }] },
      },
    }
  );
  expect(privateJwkResponse.status()).toBe(400);
  expect(await privateJwkResponse.json()).toEqual({
    error: { code: "PRIVATE_JWK_NOT_ALLOWED" },
  });
  const afterPrivateJwk = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((r) => r.json());
  expect(
    afterPrivateJwk.requests.filter(
      (item: { path: string; method: string }) =>
        item.path === "identity-config" && item.method === "PUT"
    )
  ).toHaveLength(1);
});

test("identity readiness is role-safe, suspended orgs have no prompt, and validation errors are mapped", async ({
  page,
  request,
}) => {
  await setup(request, [org("identity-member", "Member Identity", "member")]);
  await signIn(page);
  await expect(page.getByText("Identity setup chưa hoàn tất")).toBeVisible();
  await page.goto("/console/orgs/identity-member/identity");
  await expect(page.getByText(/Nhờ owner cấu hình/)).toBeVisible();
  const requests = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((r) => r.json());
  expect(
    requests.requests.some(
      (item: { path: string }) => item.path === "identity-config"
    )
  ).toBe(false);

  await setup(request, [
    org("identity-paused", "Paused", "owner", "suspended"),
  ]);
  await page.context().clearCookies();
  await signIn(page);
  await expect(page.getByRole("status")).toContainText("tạm ngưng");
  await expect(page.getByText("Identity setup chưa hoàn tất")).toHaveCount(0);

  await setup(request, [org("identity-errors", "Identity Errors")], {
    identityErrorCode: "IDENTITY_JWKS_URL_UNSAFE",
  });
  await page.context().clearCookies();
  await signIn(page);
  await page.goto("/console/orgs/identity-errors/identity");
  await page.getByLabel("Issuer").fill("https://error.example.test");
  await page
    .getByRole("textbox", { name: "JWKS URL" })
    .fill("https://internal.example.test/keys");
  await page
    .getByRole("button", { name: "Lưu identity configuration" })
    .click();
  await expect(page.locator(".identity-form [role=alert]")).toContainText(
    "JWKS URL không an toàn"
  );
});

test("stable identity source reason codes have separate safe messages", async ({
  page,
  request,
}) => {
  await setup(request, [org("identity-reasons", "Identity Reasons")]);
  await signIn(page);
  await page.goto("/console/orgs/identity-reasons/identity");
  await page.getByLabel("Issuer").fill("https://reasons.example.test");
  await page
    .getByRole("textbox", { name: "JWKS URL" })
    .fill("https://reasons.example.test/keys");
  for (const [code, message] of [
    ["IDENTITY_JWKS_SOURCE_UNAVAILABLE", "AIHUB không thể truy cập JWKS URL"],
    ["IDENTITY_JWKS_INVALID", "Public JWKS không hợp lệ"],
    ["ORGANIZATION_IDENTITY_ISSUER_CONFLICT", "Issuer này đã được dùng"],
  ]) {
    await request.post(`${mockUrl}/__test__/organizations/config`, {
      data: { identityErrorCode: code },
    });
    await page
      .getByRole("button", { name: "Lưu identity configuration" })
      .click();
    await expect(page.locator(".identity-form [role=alert]")).toContainText(
      message
    );
  }
});

test("disabled configuration requires confirmation and saves only identity inputs", async ({
  page,
  request,
}) => {
  await setup(
    request,
    [org("identity-disabled-save", "Disabled Save Org", "owner", "active")],
    {
      identityConfigs: {
        "identity-disabled-save": {
          configured: true,
          issuer: "https://saved.example.test",
          jwks_url: "https://saved.example.test/keys",
          public_keys_jwks: null,
          status: "disabled",
        },
      },
      identityErrorCode: "IDENTITY_JWKS_INVALID",
      identitySaveDelayMs: 500,
    }
  );
  await signIn(page);
  await page.goto("/console/orgs/identity-disabled-save/identity");

  await expect(page.locator(".identity-warning")).toHaveText(
    disabledIdentityCopy
  );
  await page.getByRole("radio", { name: "Dán public JWKS" }).check();
  await page.getByRole("textbox", { name: "Public JWKS (JSON)" }).fill("{");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Public JWKS phải là JSON hợp lệ."
  );
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(await identityConfigPuts(request)).toHaveLength(0);

  await page.getByRole("radio", { name: "JWKS URL (khuyến nghị)" }).check();
  await page.getByLabel("Issuer").fill("https://edited.example.test");
  const saveButton = page.getByRole("button", { name: "Lưu thay đổi" });
  await saveButton.click();
  let confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toContainText(disabledIdentityCopy);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByLabel("Issuer")).toHaveValue(
    "https://edited.example.test"
  );
  await expect(await identityConfigPuts(request)).toHaveLength(0);

  await saveButton.click();
  confirmation = page.getByRole("alertdialog");
  await page.mouse.click(8, 8);
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByLabel("Issuer")).toHaveValue(
    "https://edited.example.test"
  );
  await expect(await identityConfigPuts(request)).toHaveLength(0);

  await saveButton.click();
  confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toContainText(disabledIdentityCopy);
  await confirmation.getByRole("button", { name: "Hủy" }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByLabel("Issuer")).toHaveValue(
    "https://edited.example.test"
  );
  await expect(saveButton).toBeFocused();
  await expect(await identityConfigPuts(request)).toHaveLength(0);

  await saveButton.click();
  confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toContainText(disabledIdentityCopy);
  await confirmation.getByRole("button", { name: "Xác nhận" }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveText(
    "Public JWKS không hợp lệ hoặc không có key phù hợp. Hãy kiểm tra nội dung JSON."
  );
  await expect(page.getByLabel("Issuer")).toHaveValue(
    "https://edited.example.test"
  );
  await expect(await identityConfigPuts(request)).toHaveLength(1);

  await request.post(`${mockUrl}/__test__/organizations/config`, {
    data: { identityErrorCode: null },
  });
  await saveButton.click();
  confirmation = page.getByRole("alertdialog");
  await confirmation.getByRole("button", { name: "Xác nhận" }).click();
  await expect(
    confirmation.getByRole("button", { name: "Đang lưu…" })
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.mouse.click(8, 8);
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toHaveCount(0, { timeout: 5_000 });
  await expect(page.getByText("Đã lưu identity configuration.")).toBeVisible();

  const puts = await identityConfigPuts(request);
  expect(puts).toHaveLength(2);
  expect(puts[1].body).toEqual({
    issuer: "https://edited.example.test",
    jwks_url: "https://saved.example.test/keys",
  });
});

test("active identity configuration saves without a declared-mode confirmation", async ({
  page,
  request,
}) => {
  await setup(
    request,
    [org("identity-active-save", "Active Save Org", "owner", "active")],
    {
      identityConfigs: {
        "identity-active-save": {
          configured: true,
          issuer: "https://active.example.test",
          jwks_url: "https://active.example.test/keys",
          public_keys_jwks: null,
          status: "active",
        },
      },
    }
  );
  await signIn(page);
  await page.goto("/console/orgs/identity-active-save/identity");
  await expect(page.locator(".identity-warning")).toHaveCount(0);
  await expect(page.getByText(/Declared User ID/)).toHaveCount(0);
  await page.getByLabel("Issuer").fill("https://updated.example.test");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByText("Đã lưu identity configuration.")).toBeVisible();

  const puts = await identityConfigPuts(request);
  expect(puts).toHaveLength(1);
  expect(puts[0].body).toEqual({
    issuer: "https://updated.example.test",
    jwks_url: "https://active.example.test/keys",
  });
});

test("disabled configuration remains editable with operator warning and stale 403 clears values", async ({
  page,
  request,
}) => {
  await setup(
    request,
    [org("identity-disabled", "Disabled Org", "owner", "active")],
    {
      identityConfigs: {
        "identity-disabled": {
          configured: true,
          issuer: "https://saved.example.test",
          jwks_url: "https://saved.example.test/keys",
          public_keys_jwks: null,
          status: "disabled",
        },
      },
    }
  );
  await signIn(page);
  await page.goto("/console/orgs/identity-disabled/identity");
  await expect(page.locator(".identity-warning")).toHaveText(
    disabledIdentityCopy
  );
  await expect(page.getByLabel("Issuer")).toHaveValue(
    "https://saved.example.test"
  );
  await request.post(`${mockUrl}/__test__/organizations/config`, {
    data: { identityForbiddenOnce: true },
  });
  await page.getByLabel("Issuer").fill("https://not-saved.example.test");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Xác nhận" })
    .click();
  await expect(
    page.locator(".identity-dialog .identity-safe-notice")
  ).toContainText("đã được xóa khỏi màn hình");
  await expect(page.getByLabel("Issuer")).toHaveCount(0);
});

test("a 403 while loading identity settings refreshes the roster and hides all config values", async ({
  page,
  request,
}) => {
  await setup(
    request,
    [org("identity-get-forbidden", "Identity Get Forbidden")],
    {
      identityForbiddenOnce: true,
      identityConfigs: {
        "identity-get-forbidden": {
          configured: true,
          issuer: "https://private-detail.example.test",
          jwks_url: "https://private-detail.example.test/keys",
          public_keys_jwks: null,
          status: "active",
        },
      },
    }
  );
  const rosterCountBefore = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((r) => r.json())
    .then(
      (state) =>
        state.requests.filter(
          (item: { path: string }) => item.path === "roster"
        ).length
    );
  await signIn(page);
  await page.goto("/console/orgs/identity-get-forbidden");
  await page.getByRole("button", { name: "Cấu hình identity" }).click();
  await expect(
    page.locator(".identity-dialog .identity-safe-notice")
  ).toContainText("Không có issuer hoặc JWKS nào được hiển thị");
  await expect(
    page.getByText("https://private-detail.example.test", { exact: false })
  ).toHaveCount(0);
  const requests = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((r) => r.json());
  expect(
    requests.requests.filter((item: { path: string }) => item.path === "roster")
      .length - rosterCountBefore
  ).toBeGreaterThanOrEqual(2);
});

test("creation limit explains the next step", async ({ page, request }) => {
  await setup(request, [], { creationLimit: true });
  await signIn(page);
  await page.getByRole("button", { name: "Tạo Organization" }).click();
  await page.getByLabel("Tên Organization").fill("Another Org");
  await page
    .locator("form.auth-form")
    .getByRole("button", { name: "Tạo Organization" })
    .click();
  await expect(page.locator("form.auth-form").getByRole("alert")).toContainText(
    "Organization Creation Limit"
  );
});

test("active owner can rename; backend denial and foreign IDs use generic denial", async ({
  page,
  request,
}) => {
  await setup(request, [org("rename-id", "Before")]);
  await signIn(page);
  await page.goto("/console/orgs/rename-id");
  await page.getByLabel("Đổi tên Organization").fill("After");
  await page.getByRole("button", { name: "Lưu tên mới" }).click();
  await expect(page.getByRole("heading", { name: "After" })).toBeVisible();

  await setup(request, [org("rename-id", "After")], { renameDenied: true });
  await page.goto("/console/orgs/rename-id");
  await page.getByLabel("Đổi tên Organization").fill("Denied");
  await page.getByRole("button", { name: "Lưu tên mới" }).click();
  await expect(page).toHaveURL(/\/console\/orgs\/denied$/);
  await expect(
    page.getByText(
      "Không tìm thấy Organization hoặc bạn không có quyền truy cập."
    )
  ).toBeVisible();

  await page.goto("/console/orgs/unknown-org");
  await expect(page).toHaveURL(/\/console\/orgs\/denied$/);
  await expect(
    page.getByText(
      "Không tìm thấy Organization hoặc bạn không có quyền truy cập."
    )
  ).toBeVisible();

  const sessionCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "__Host-aihub_web_session"
  );
  const foreignRename = await request.patch(
    `${new URL(page.url()).origin}/api/organizations/foreign-org-known`,
    {
      headers: {
        Origin: new URL(page.url()).origin,
        Cookie: `${sessionCookie!.name}=${sessionCookie!.value}`,
      },
      data: { name: "Probe" },
    }
  );
  expect(foreignRename.status()).toBe(404);
  await page.goto("/console/orgs/foreign-org-known");
  await expect(page).toHaveURL(/\/console\/orgs\/denied$/);
  await expect(
    page.getByText(
      "Không tìm thấy Organization hoặc bạn không có quyền truy cập."
    )
  ).toBeVisible();
});
