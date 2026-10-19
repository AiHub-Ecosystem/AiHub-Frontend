import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type Route,
} from "@playwright/test";
import { waitForHydration } from "./hydration";

const mockUrl = "http://127.0.0.1:3101";
const appUrl = "http://127.0.0.1:3100";
const validPassword = "correct horse battery staple";
const existingAvatar = {
  asset_id: "ava_01ARZ3NDEKTSV4RRFFQ69G5FAV",
  content_type: "image/png",
  byte_size: 128,
  accepted_at: "2026-01-01T00:00:00.000Z",
  url: "https://s3.wispace.app/existing.webp",
};

async function prepareMocks(
  request: APIRequestContext,
  config: Record<string, unknown> = {}
) {
  await request.post(`${mockUrl}/__test__/auth/reset`);
  await request.post(`${mockUrl}/__test__/avatar/config`, {
    data: { username: "e\u0301clair", avatar: null, ...config },
  });
}

async function signIn(page: Page) {
  await page.goto("/login");
  await waitForHydration(page);
  await page.getByLabel("Email").fill("valid@example.test");
  await page.getByLabel("Mật khẩu").fill(validPassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/console\/orgs$/);
  await waitForHydration(page);
}

async function openAccountMenu(page: Page) {
  await page.locator(".account-menu > summary").click();
  await expect(
    page.getByRole("region", { name: "Ảnh đại diện tài khoản" })
  ).toBeVisible();
}

async function mockStorage(page: Page, status = 200, failImages = false) {
  const uploads: { body: Buffer | null; headers: Record<string, string> }[] =
    [];
  await page.route("https://s3.wispace.app/**", async (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": appUrl,
          "Access-Control-Allow-Methods": "GET, PUT",
          "Access-Control-Allow-Headers": "content-type, cache-control",
        },
      });
      return;
    }
    if (route.request().method() === "PUT") {
      uploads.push({
        body: route.request().postDataBuffer(),
        headers: route.request().headers(),
      });
      await route.fulfill({
        status,
        headers: { "Access-Control-Allow-Origin": appUrl },
      });
      return;
    }
    await route.fulfill(
      failImages
        ? { status: 404 }
        : {
            status: 200,
            headers: { "Content-Type": "image/svg+xml" },
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
          }
    );
  });
  return uploads;
}

test("the signed-in account menu shows the Username initial when no Avatar exists", async ({
  page,
  request,
}) => {
  await prepareMocks(request);
  await signIn(page);

  await page.locator(".account-menu > summary").click();
  await expect(
    page.getByRole("img", { name: "Ký tự đầu tên người dùng" })
  ).toHaveText("E\u0301");
});

test("upload and replace send image bytes only to storage, then confirm with AIHUB", async ({
  page,
  request,
}) => {
  await prepareMocks(request);
  const uploads = await mockStorage(page);
  await signIn(page);
  await openAccountMenu(page);
  const fileInput = page.getByLabel("Chọn ảnh đại diện");

  await fileInput.setInputFiles({
    name: "first.png",
    mimeType: "image/png",
    buffer: Buffer.from("first avatar bytes"),
  });
  await expect(page.getByRole("img", { name: "Ảnh đại diện" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thay ảnh" })).toBeVisible();
  await fileInput.setInputFiles({
    name: "replacement.webp",
    mimeType: "image/webp",
    buffer: Buffer.from("replacement avatar bytes"),
  });
  await expect(page.getByRole("img", { name: "Ảnh đại diện" })).toHaveAttribute(
    "src",
    /ava_00000000000000000000000002\.webp$/
  );

  expect(uploads).toHaveLength(2);
  expect(uploads[0].body?.toString()).toBe("first avatar bytes");
  expect(uploads[1].body?.toString()).toBe("replacement avatar bytes");
  for (const upload of uploads) {
    expect(upload.headers.cookie).toBeUndefined();
  }
  const { requests } = await (
    await request.get(`${mockUrl}/__test__/avatar/requests`)
  ).json();
  expect(
    requests.filter((item: { path: string }) => item.path === "upload-grant")
  ).toEqual([
    expect.objectContaining({ contentType: "image/png", byteSize: 18 }),
    expect.objectContaining({ contentType: "image/webp", byteSize: 24 }),
  ]);
  expect(
    requests.filter((item: { path: string }) => item.path === "complete")
  ).toHaveLength(2);
});

test("invalid files are rejected in the browser without requesting an upload", async ({
  page,
  request,
}) => {
  await prepareMocks(request);
  await signIn(page);
  await openAccountMenu(page);
  await page.getByLabel("Chọn ảnh đại diện").setInputFiles({
    name: "avatar.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.locator(".account-avatar-error")).toContainText(
    "JPEG, PNG hoặc WebP"
  );
  await page.getByLabel("Chọn ảnh đại diện").setInputFiles({
    name: "too-large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  await expect(page.locator(".account-avatar-error")).toContainText(
    "tối đa 2 MiB"
  );
  const { requests } = await (
    await request.get(`${mockUrl}/__test__/avatar/requests`)
  ).json();
  expect(
    requests.some((item: { path: string }) => item.path === "upload-grant")
  ).toBe(false);
});

test("a storage failure keeps the current avatar and reports the failure", async ({
  page,
  request,
}) => {
  await prepareMocks(request, { avatar: existingAvatar });
  await mockStorage(page, 500);
  await signIn(page);
  await openAccountMenu(page);
  await expect(page.getByRole("img", { name: "Ảnh đại diện" })).toHaveAttribute(
    "src",
    existingAvatar.url
  );
  await page.getByLabel("Chọn ảnh đại diện").setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: Buffer.from("replacement"),
  });
  await expect(page.locator(".account-avatar-error")).toContainText(
    "Bộ lưu trữ ảnh đang gặp sự cố"
  );
  await expect(page.getByRole("img", { name: "Ảnh đại diện" })).toHaveAttribute(
    "src",
    existingAvatar.url
  );
});

test("a confirmation failure keeps the existing Avatar", async ({
  page,
  request,
}) => {
  await prepareMocks(request, {
    avatar: existingAvatar,
    completeStatus: 503,
    completeErrorCode: "AVATAR_STORAGE_UNAVAILABLE",
  });
  await mockStorage(page);
  await signIn(page);
  await openAccountMenu(page);
  await page.getByLabel("Chọn ảnh đại diện").setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: Buffer.from("replacement"),
  });
  await expect(page.locator(".account-avatar-error")).toContainText(
    "thử lại sau"
  );
  await expect(page.getByRole("img", { name: "Ảnh đại diện" })).toHaveAttribute(
    "src",
    existingAvatar.url
  );
});

test("an invalid confirmed Avatar URL is rejected and leaves the current Avatar", async ({
  page,
  request,
}) => {
  await prepareMocks(request, {
    avatar: existingAvatar,
    completeAvatar: {
      ...existingAvatar,
      url: "https://attacker.example/avatar",
    },
  });
  await mockStorage(page);
  await signIn(page);
  await openAccountMenu(page);
  await page.getByLabel("Chọn ảnh đại diện").setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: Buffer.from("replacement"),
  });
  await expect(page.locator(".account-avatar-error")).toContainText(
    "Ảnh hiện tại vẫn được giữ nguyên"
  );
  await expect(page.getByRole("img", { name: "Ảnh đại diện" })).toHaveAttribute(
    "src",
    existingAvatar.url
  );
});

test("an untrusted upload origin is rejected before browser PUT", async ({
  page,
  request,
}) => {
  await prepareMocks(request, {
    avatar: existingAvatar,
    uploadUrl: "https://attacker.example/upload",
  });
  const uploads = await mockStorage(page);
  await signIn(page);
  await openAccountMenu(page);
  await page.getByLabel("Chọn ảnh đại diện").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from("avatar bytes"),
  });
  await expect(page.locator(".account-avatar-error")).toBeVisible();
  expect(uploads).toHaveLength(0);
  await expect(page.getByRole("img", { name: "Ảnh đại diện" })).toHaveAttribute(
    "src",
    existingAvatar.url
  );
});

test("AIHUB authorization denial is actionable and preserves the current Avatar", async ({
  page,
  request,
}) => {
  await prepareMocks(request, {
    avatar: existingAvatar,
    uploadStatus: 401,
    uploadErrorCode: "AUTH_USER_ACCESS_TOKEN_INVALID",
  });
  await mockStorage(page);
  await signIn(page);
  await openAccountMenu(page);
  await page.getByLabel("Chọn ảnh đại diện").setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: Buffer.from("replacement"),
  });
  await expect(page.locator(".account-avatar-error")).toContainText(
    "Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại."
  );
  await expect(page.getByRole("img", { name: "Ảnh đại diện" })).toHaveAttribute(
    "src",
    existingAvatar.url
  );
});

test("a failed Avatar image uses the Username initial fallback", async ({
  page,
  request,
}) => {
  await prepareMocks(request, { avatar: existingAvatar });
  await mockStorage(page, 200, true);
  await signIn(page);
  await openAccountMenu(page);
  await expect(
    page.getByRole("img", { name: "Ký tự đầu tên người dùng" })
  ).toHaveText("E\u0301");
});

test("remove confirms before clearing the Avatar", async ({
  page,
  request,
}) => {
  await prepareMocks(request, { avatar: existingAvatar });
  await mockStorage(page);
  await signIn(page);
  await openAccountMenu(page);
  await page.getByRole("button", { name: "Xóa ảnh", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Xóa ảnh", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Ký tự đầu tên người dùng" })
  ).toHaveText("E\u0301");
  await expect(
    page.getByRole("button", { name: "Xóa ảnh", exact: true })
  ).toHaveCount(0);
});

test("a rejected removal keeps the Avatar and shows a retry message", async ({
  page,
  request,
}) => {
  await prepareMocks(request, {
    avatar: existingAvatar,
    deleteStatus: 503,
    deleteErrorCode: "AVATAR_STORAGE_UNAVAILABLE",
  });
  await mockStorage(page);
  await signIn(page);
  await openAccountMenu(page);
  await page.getByRole("button", { name: "Xóa ảnh", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Xóa ảnh", exact: true })
    .click();
  await expect(page.locator(".account-avatar-error")).toContainText(
    "thử lại sau"
  );
  await expect(page.getByRole("img", { name: "Ảnh đại diện" })).toHaveAttribute(
    "src",
    existingAvatar.url
  );
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("an AVATAR_CHANGED confirmation refreshes the current Avatar", async ({
  page,
  request,
}) => {
  const changedAvatar = {
    ...existingAvatar,
    asset_id: "ava_01ARZ3NDEKTSV4RRFFQ69G5FAW",
    url: "https://s3.wispace.app/concurrent.webp",
  };
  await prepareMocks(request, {
    avatar: existingAvatar,
    completeStatus: 409,
    completeErrorCode: "AVATAR_CHANGED",
  });
  await mockStorage(page);
  await page.route(
    "**/api/account/avatar/uploads/*/complete",
    async (route) => {
      await request.post(`${mockUrl}/__test__/avatar/config`, {
        data: { avatar: changedAvatar },
      });
      await route.continue();
    }
  );
  await signIn(page);
  await openAccountMenu(page);
  await page.getByLabel("Chọn ảnh đại diện").setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: Buffer.from("replacement"),
  });
  await expect(page.getByRole("img", { name: "Ảnh đại diện" })).toHaveAttribute(
    "src",
    changedAvatar.url
  );
  await expect(page.locator(".account-avatar-error")).toContainText(
    "đã được cập nhật ở nơi khác"
  );
});

test("a failed AVATAR_CHANGED refresh reports that account data could not be loaded", async ({
  page,
  request,
}) => {
  await prepareMocks(request, {
    avatar: existingAvatar,
    completeStatus: 409,
    completeErrorCode: "AVATAR_CHANGED",
  });
  await mockStorage(page);
  await signIn(page);
  await openAccountMenu(page);
  await page.route("**/api/account", async (route) => {
    await route.fulfill({
      status: 503,
      json: { error: { code: "ACCOUNT_UNAVAILABLE" } },
    });
  });
  await page.getByLabel("Chọn ảnh đại diện").setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: Buffer.from("replacement"),
  });
  await expect(page.locator(".account-avatar-error")).toHaveText(
    "Không thể tải thông tin tài khoản."
  );
  await expect(page.getByRole("img", { name: "Ảnh đại diện" })).toHaveAttribute(
    "src",
    existingAvatar.url
  );
});

test("avatar upload API rejects an unauthenticated caller", async ({
  request,
}) => {
  await prepareMocks(request);
  const response = await request.post(`${appUrl}/api/account/avatar/uploads`, {
    headers: { Origin: appUrl },
    data: { content_type: "image/png", byte_size: 128 },
  });
  expect(response.status()).toBe(401);
  const { requests } = await (
    await request.get(`${mockUrl}/__test__/avatar/requests`)
  ).json();
  expect(
    requests.some((item: { path: string }) => item.path === "upload-grant")
  ).toBe(false);
});

test("avatar upload BFF accepts metadata only and rejects any image payload", async ({
  page,
  request,
}) => {
  await prepareMocks(request);
  await signIn(page);
  const status = await page.evaluate(async () => {
    const response = await fetch("/api/account/avatar/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content_type: "image/png",
        byte_size: 128,
        image: "A".repeat(2048),
      }),
    });
    return response.status;
  });
  expect(status).toBe(400);
  const { requests } = await (
    await request.get(`${mockUrl}/__test__/avatar/requests`)
  ).json();
  expect(
    requests.some((item: { path: string }) => item.path === "upload-grant")
  ).toBe(false);
});
