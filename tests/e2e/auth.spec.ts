import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const appUrl = "http://127.0.0.1:3100";
const mockUrl = "http://127.0.0.1:3101";
const secondAppUrl = "http://127.0.0.1:3105";
const validPassword = "correct horse battery staple";

async function resetAuthMock(request: APIRequestContext) {
  const response = await request.post(`${mockUrl}/__test__/auth/reset`);
  expect(response.status()).toBe(204);
}

async function signIn(page: Page, email = "valid@example.test") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(validPassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/console$/);
}

async function createSession(request: APIRequestContext, email: string) {
  const response = await request.post(`${appUrl}/api/auth/login`, {
    headers: { Origin: appUrl },
    form: { email, password: validPassword },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  const cookie = response
    .headers()
    ["set-cookie"]?.match(/__Host-aihub_web_session=([^;]+)/)?.[1];
  expect(cookie).toBeTruthy();
  return `__Host-aihub_web_session=${cookie}`;
}

test("sign-in keeps AIHUB credentials server-side and logout clears the session", async ({
  page,
  request,
}) => {
  await resetAuthMock(request);
  await page.goto("/login?next=https%3A%2F%2Fattacker.test%2Fcollect");
  await expect(
    page.getByRole("link", { name: "Đăng nhập", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Đăng ký", exact: true })
  ).toHaveAttribute("href", "/register");

  await page.getByLabel("Email").fill("valid@example.test");
  await page.getByLabel("Mật khẩu").fill(validPassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/console$/);
  await expect(
    page.getByRole("heading", { name: "Console", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Console", exact: true })
  ).toBeVisible();

  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(
    (cookie) => cookie.name === "__Host-aihub_web_session"
  );
  expect(sessionCookie).toBeDefined();
  expect(sessionCookie).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
  });
  expect(cookies.some((cookie) => cookie.name === "__Host-aihub_refresh")).toBe(
    false
  );
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "aihub_web_session"
  );
  expect(await page.locator("body").innerText()).not.toContain("access-token-");

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Console", exact: true })
  ).toBeVisible();
  await page.getByText("Tài khoản", { exact: true }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  await expect(
    page.getByRole("link", { name: "Đăng nhập", exact: true })
  ).toBeVisible();
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "__Host-aihub_web_session"
    )
  ).toBe(false);

  await page.goBack();
  await expect(page).toHaveURL(/\/login\?next=%2Fconsole/);
  await expect(
    page.getByRole("heading", { name: "Console", exact: true })
  ).toHaveCount(0);
});

test("a visitor can register and safely request another verification email", async ({
  page,
  request,
}) => {
  await resetAuthMock(request);
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Đăng ký", exact: true })
  ).toBeVisible();
  await page.getByLabel("Email").fill("new@example.test");
  await page.getByLabel("Username").fill("new-user");
  await page.getByLabel("Mật khẩu").fill(validPassword);
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: "Kiểm tra email", exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("new@example.test", { exact: true })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Gửi lại email", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Kiểm tra email" }).getByRole("alert")
  ).toHaveText(
    "Nếu địa chỉ email này có User Account, chúng tôi sẽ gửi hướng dẫn phù hợp."
  );

  const logged = await request.get(`${mockUrl}/__test__/auth/requests`);
  const authRequests = (await logged.json()).requests;
  expect(
    authRequests.filter((entry: { path: string }) => entry.path === "register")
  ).toHaveLength(1);
  expect(
    authRequests.filter((entry: { path: string }) => entry.path === "resend")
  ).toHaveLength(1);
});

test("email verification removes its token from the URL and offers generic recovery", async ({
  page,
  request,
}) => {
  await resetAuthMock(request);
  const response = await request.get(
    `${appUrl}/verify-email?token=private-verification-token`
  );
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");

  await page.goto(`${appUrl}/verify-email?token=private-verification-token`);
  await expect(page).toHaveURL(`${appUrl}/verify-email`);
  await expect(
    page.getByRole("heading", { name: "Email đã được xác minh", exact: true })
  ).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(
    "private-verification-token"
  );
  expect(
    (await page.context().cookies()).some((cookie) =>
      cookie.name.includes("session")
    )
  ).toBe(false);

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Xác minh email" }).getByRole("alert")
  ).toContainText("không hợp lệ hoặc đã hết hạn");
  await page
    .getByRole("textbox", { name: "Email" })
    .fill("recovery@example.test");
  await page
    .getByRole("button", { name: "Gửi hướng dẫn xác minh", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Xác minh email" }).getByRole("alert")
  ).toHaveText(
    "Nếu địa chỉ email này có User Account, chúng tôi sẽ gửi hướng dẫn phù hợp."
  );

  const logged = await request.get(`${mockUrl}/__test__/auth/requests`);
  const authRequests = (await logged.json()).requests;
  expect(
    authRequests.filter((entry: { path: string }) => entry.path === "verify")
  ).toEqual([{ path: "verify", hasToken: true }]);
  expect(
    authRequests.filter((entry: { path: string }) => entry.path === "resend")
  ).toEqual([{ path: "resend", hasEmail: true }]);
});

test("an invalid verification link gets the same generic recovery form", async ({
  page,
  request,
}) => {
  await resetAuthMock(request);
  await page.goto(`${appUrl}/verify-email?token=invalid-expired-secret`);
  await expect(page).toHaveURL(`${appUrl}/verify-email`);
  await expect(
    page.getByRole("region", { name: "Xác minh email" }).getByRole("alert")
  ).toContainText("không hợp lệ hoặc đã hết hạn");
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(
    "invalid-expired-secret"
  );
});

test("registration reports a duplicate identity and clears only the password", async ({
  page,
  request,
}) => {
  await resetAuthMock(request);
  await page.goto("/register");
  await page.getByLabel("Email").fill("taken@example.test");
  await page.getByLabel("Username").fill("kept-username");
  await page.getByLabel("Mật khẩu").fill(validPassword);
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();

  await expect(
    page.getByRole("region", { name: "Đăng ký" }).getByRole("alert")
  ).toContainText("Email hoặc username đã được dùng");
  await expect(page.getByLabel("Email")).toHaveValue("taken@example.test");
  await expect(page.getByLabel("Username")).toHaveValue("kept-username");
  await expect(page.getByLabel("Mật khẩu")).toHaveValue("");
});

test("credential failures share one message and rate limits show a retry delay", async ({
  page,
  request,
}) => {
  await resetAuthMock(request);
  const messages: string[] = [];
  for (const email of [
    "wrong@example.test",
    "pending@example.test",
    "disabled@example.test",
  ]) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Mật khẩu").fill(validPassword);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    messages.push(await alert.innerText());
  }
  expect(new Set(messages).size).toBe(1);
  expect(messages[0]).toBe("Email hoặc mật khẩu không đúng.");

  await page.goto("/login");
  await page.getByLabel("Email").fill("rate-limit@example.test");
  await page.getByLabel("Mật khẩu").fill(validPassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 17 giây."
  );
});

test("rejects foreign or missing Origin and coordinates refresh across app instances", async ({
  page,
  request,
}) => {
  await resetAuthMock(request);
  const originCases: Record<string, string>[] = [
    { Origin: "https://attacker.test" },
    {},
  ];
  for (const path of ["login", "logout", "session"]) {
    for (const headers of originCases) {
      const response = await request.post(`${appUrl}/api/auth/${path}`, {
        headers,
        form: { email: "valid@example.test", password: validPassword },
      });
      expect(response.status()).toBe(403);
    }
  }
  for (const path of ["register", "resend-verification", "verify-email"]) {
    for (const headers of originCases) {
      const response = await request.post(`${appUrl}/api/auth/${path}`, {
        headers,
        data:
          path === "register"
            ? {
                email: "user@example.test",
                username: "user",
                password: validPassword,
              }
            : path === "verify-email"
              ? { token: "test-token" }
              : { email: "user@example.test" },
      });
      expect(response.status()).toBe(403);
    }
  }
  const beforeLogin = await request.get(`${mockUrl}/__test__/auth/requests`);
  expect((await beforeLogin.json()).requests).toEqual([]);

  const cookie = await createSession(request, "expiring@example.test");
  const touched = await request.post(`${appUrl}/api/auth/session`, {
    headers: { Origin: appUrl, Cookie: cookie },
    data: {},
  });
  expect(touched.status()).toBe(204);
  expect(touched.headers()["set-cookie"]).toContain("Max-Age=2592000");
  await page.waitForTimeout(2_100);
  const cookieHeader = { Cookie: cookie };
  const [first, second] = await Promise.all([
    request.get("http://127.0.0.1:3100/console", { headers: cookieHeader }),
    request.get(`${secondAppUrl}/console`, { headers: cookieHeader }),
  ]);
  expect(first.status()).toBe(200);
  expect(second.status()).toBe(200);
  expect(await first.text()).toContain("Console");
  expect(await second.text()).toContain("Console");

  const logged = await request.get(`${mockUrl}/__test__/auth/requests`);
  const authRequests = (await logged.json()).requests;
  expect(
    authRequests.filter((entry: { path: string }) => entry.path === "refresh")
  ).toHaveLength(1);
  expect(
    authRequests.filter((entry: { path: string }) => entry.path === "login")
  ).toHaveLength(1);
});

test("a rejected refresh ends the session and logout clears it during an AIHUB outage", async ({
  page,
  request,
}) => {
  await resetAuthMock(request);
  await request.post(`${mockUrl}/__test__/auth/mode`, {
    data: { refreshUnauthorized: true },
  });
  await page.goto("/login");
  await page.getByLabel("Email").fill("expiring@example.test");
  await page.getByLabel("Mật khẩu").fill(validPassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?error=session/);
  await expect
    .poll(async () =>
      (await page.context().cookies()).some(
        (cookie) => cookie.name === "__Host-aihub_web_session"
      )
    )
    .toBe(false);

  await resetAuthMock(request);
  await signIn(page);
  const logoutCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "__Host-aihub_web_session"
  );
  await request.post(`${mockUrl}/__test__/auth/mode`, {
    data: { logoutDown: true },
  });
  await page.getByText("Tài khoản", { exact: true }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "__Host-aihub_web_session"
    )
  ).toBe(false);
  const protectedPage = await request.get("http://127.0.0.1:3100/console", {
    headers: { Cookie: `${logoutCookie!.name}=${logoutCookie!.value}` },
  });
  expect(protectedPage.status()).toBe(200);
  expect(await protectedPage.text()).toContain("Đăng nhập");

  const logged = await request.get(`${mockUrl}/__test__/auth/requests`);
  const authRequests = (await logged.json()).requests;
  expect(
    authRequests.some((entry: { path: string }) => entry.path === "logout")
  ).toBe(true);
});

test("sign-out during token refresh cannot recreate the Web Session", async ({
  request,
}) => {
  await resetAuthMock(request);
  const cookie = await createSession(request, "expiring@example.test");
  await new Promise((resolve) => setTimeout(resolve, 2_100));

  const consoleResponse = request.get(`${appUrl}/console`, {
    headers: { Cookie: cookie },
  });
  await expect
    .poll(async () => {
      const response = await request.get(`${mockUrl}/__test__/auth/requests`);
      return (await response.json()).requests.filter(
        (entry: { path: string }) => entry.path === "refresh"
      ).length;
    })
    .toBe(1);

  const logout = await request.post(`${appUrl}/api/auth/logout`, {
    headers: { Origin: appUrl, Cookie: cookie },
    maxRedirects: 0,
  });
  expect(logout.status()).toBe(303);
  expect(await (await consoleResponse).text()).toContain("Đăng nhập");

  const protectedPage = await request.get(`${appUrl}/console`, {
    headers: { Cookie: cookie },
  });
  expect(await protectedPage.text()).toContain("Đăng nhập");
});
