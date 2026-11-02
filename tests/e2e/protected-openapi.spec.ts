import { expect, test, type APIRequestContext } from "@playwright/test";
import { waitForHydration } from "./hydration";

const appUrl = "http://127.0.0.1:3100";
const mockUrl = "http://127.0.0.1:3101";
const validPassword = "correct horse battery staple";

async function resetAuthMock(request: APIRequestContext) {
  const response = await request.post(`${mockUrl}/__test__/auth/reset`);
  expect(response.status()).toBe(204);
}

test("anonymous users sign in before Scalar and can download the protected contracts", async ({
  page,
  request,
}) => {
  await resetAuthMock(request);
  const browserAuthorizationHeaders: string[] = [];
  page.on("request", (browserRequest) => {
    browserAuthorizationHeaders.push(
      browserRequest.headers().authorization ?? ""
    );
  });

  await page.goto("/docs/reference");
  await expect(page).toHaveURL(/\/login\?next=%2Fdocs%2Freference$/u);
  const anonymousDownload = await page
    .context()
    .request.get(`${appUrl}/api/docs/openapi.json`);
  expect(anonymousDownload.status()).toBe(401);

  await waitForHydration(page);
  await page.getByLabel("Email").fill("valid@example.test");
  await page.getByLabel("Mật khẩu").fill(validPassword);
  const scalarScriptResponse = page.waitForResponse((response) =>
    response
      .url()
      .startsWith("https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.1")
  );
  const scalarSpecResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/docs/openapi/v1.json"
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/reference$/u);
  const [scalarScript, scalarSpec] = await Promise.all([
    scalarScriptResponse,
    scalarSpecResponse,
  ]);
  expect(scalarScript.ok()).toBe(true);
  expect(scalarSpec.ok()).toBe(true);
  expect((await scalarSpec.json()).info.title).toBe("AIHUB API");

  await expect(page.locator("#api-reference")).toHaveAttribute(
    "data-url",
    "/api/docs/openapi/v1.json"
  );
  await expect(
    page.getByRole("link", { name: "Download latest OpenAPI JSON" })
  ).toHaveAttribute("download", "openapi.json");
  await expect(
    page.getByRole("link", { name: "Download OpenAPI v1 JSON" })
  ).toHaveAttribute("download", "openapi-v1.json");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download latest OpenAPI JSON" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("openapi.json");

  const versionedDownload = await page.evaluate(async () => {
    const response = await fetch("/api/docs/openapi/v1.json");
    return {
      status: response.status,
      disposition: response.headers.get("content-disposition"),
      document: await response.json(),
    };
  });
  expect(versionedDownload.status).toBe(200);
  expect(versionedDownload.disposition).toContain('filename="openapi-v1.json"');
  expect(versionedDownload.document.info.version).toBe("1.7.0");

  const browserState = await page.evaluate(() => ({
    cookies: document.cookie,
    html: document.documentElement.outerHTML,
    storage: [localStorage, sessionStorage].flatMap((store) =>
      Object.keys(store).map((key) => [key, store.getItem(key)])
    ),
  }));
  expect(JSON.stringify(browserState)).not.toContain("access-token-");
  expect(browserAuthorizationHeaders.every((header) => header === "")).toBe(
    true
  );

  const trace = await request.get(`${mockUrl}/__test__/docs/requests`);
  const requests = (await trace.json()).requests as {
    pathname: string;
    bearerForwarded: boolean;
  }[];
  expect(requests.map(({ pathname }) => pathname)).toEqual([
    "/docs",
    "/openapi/v1.json",
    "/openapi.json",
    "/openapi/v1.json",
  ]);
  expect(requests.every(({ bearerForwarded }) => bearerForwarded)).toBe(true);
});

test("the integration guide and curated API reference stay public", async ({
  page,
}) => {
  await page.goto("/docs");
  await expect(
    page.getByRole("heading", {
      name: "Đưa tính năng chấm AI vào ứng dụng của bạn",
    })
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Mở API Reference đầy đủ (cần đăng nhập)",
    })
  ).toHaveAttribute("href", "/docs/reference");

  await page.goto("/product/scoring/api/grade-task1");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(".aihub-path")).toContainText(
    "/v1/ielts/writing/task1/grade"
  );
});
