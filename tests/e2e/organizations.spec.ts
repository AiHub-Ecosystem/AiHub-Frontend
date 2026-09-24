import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const mockUrl = "http://127.0.0.1:3101";
const password = "correct horse battery staple";
type RosterItem = {
  organization: { id: string; name: string; status: string };
  membership_role: string;
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

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
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
  organization: { id, name, status },
  membership_role: role,
});

test("sign-in routes zero, owner, admin, member, and suspended rosters", async ({
  page,
  request,
}) => {
  await setup(request);
  await signIn(page);
  await expect(page).toHaveURL(/\/console\/orgs\/new$/);
  await expect(
    page.getByRole("heading", { name: "Tạo Organization" })
  ).toBeVisible();

  await setup(request, [org("owner-id", "Owner Org")]);
  await signIn(page);
  await expect(page).toHaveURL(/\/console\/orgs\/owner-id\/api-keys$/);
  await expect(
    page.getByRole("heading", { name: "Owner Org · API keys" })
  ).toBeVisible();

  await setup(request, [org("admin-id", "Admin Org", "admin")]);
  await signIn(page);
  await expect(page).toHaveURL(/\/console\/orgs\/admin-id\/api-keys$/);
  await expect(
    page.getByRole("heading", { name: "Admin Org · API keys" })
  ).toBeVisible();

  await setup(request, [org("member-id", "Member Org", "member")]);
  await signIn(page);
  await expect(page).toHaveURL(/\/console\/orgs\/member-id$/);
  await expect(page.getByText("Membership Role: member")).toBeVisible();
  await expect(page.getByRole("button", { name: "Lưu tên mới" })).toHaveCount(
    0
  );

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
  await expect(page).toHaveURL(/\/console$/);
  const picker = page.getByRole("navigation", { name: "Organizations" });
  await expect(picker.getByText("owner · active")).toBeVisible();
  await expect(picker.getByText("member · active")).toBeVisible();
  await expect(picker.getByText("12345678", { exact: true })).toBeVisible();
  await expect(picker.getByText("98765432", { exact: true })).toBeVisible();
  await picker.getByRole("link", { name: /Same name.*member/ }).click();
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
  await expect(page).toHaveURL(/\/console\/orgs\/one\/api-keys$/);
});

test("create uses server BFF, handles double click and creation limit", async ({
  page,
  request,
}) => {
  await setup(request);
  await signIn(page);
  await page.getByLabel("Tên Organization").fill("  New Org  ");
  const submit = page.getByRole("button", { name: "Tạo Organization" });
  await submit.dblclick();
  await expect(page).toHaveURL(
    /\/console\/orgs\/org-created-12345678\/api-keys$/
  );
  const log = await request
    .get(`${mockUrl}/__test__/organizations/requests`)
    .then((r) => r.json());
  expect(
    log.requests.filter((entry: { path: string }) => entry.path === "create")
  ).toHaveLength(1);

  await setup(request, [], { createUncertainOnce: true });
  await signIn(page);
  await page.getByLabel("Tên Organization").fill("Retry Org");
  await page.getByRole("button", { name: "Tạo Organization" }).click();
  await expect(page.locator("form.auth-form").getByRole("alert")).toContainText(
    "thử lại an toàn"
  );
  await page.getByRole("button", { name: "Tạo Organization" }).click();
  await expect(page).toHaveURL(
    /\/console\/orgs\/org-created-12345678\/api-keys$/
  );
  const state = await request
    .get(`${mockUrl}/__test__/organizations/state`)
    .then((r) => r.json());
  expect(state.organizations).toHaveLength(1);

  await setup(request, [], { creationLimit: true });
  await signIn(page);
  await page.getByLabel("Tên Organization").fill("Another Org");
  await page.getByRole("button", { name: "Tạo Organization" }).click();
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
