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
  test.setTimeout(60_000);
  await resetAuthMock(request);
  const browserAuthorizationHeaders: string[] = [];
  page.on("request", (browserRequest) => {
    browserAuthorizationHeaders.push(
      browserRequest.headers().authorization ?? ""
    );
  });

  await page.goto("/app/docs/reference");
  await expect(page).toHaveURL(
    /\/app\/login\?next=%2Fapp%2Fdocs%2Freference$/u
  );
  const anonymousDownload = await page
    .context()
    .request.get(`${appUrl}/app/api/docs/openapi.json`);
  expect(anonymousDownload.status()).toBe(401);

  await waitForHydration(page);
  await page.getByLabel("Email").fill("valid@example.test");
  await page.getByLabel("Mật khẩu").fill(validPassword);
  // The CDN is external; a blocked/slow script must not fail the auth assertions.
  const scalarScriptResponse = page
    .waitForResponse((response) =>
      response
        .url()
        .startsWith("https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.1")
    )
    .catch(() => null);
  const scalarSpecResponse = page
    .waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/app/api/docs/openapi/v1.json"
    )
    .catch(() => null);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/docs\/reference$/u);
  const [scalarScript, scalarSpec] = await Promise.all([
    scalarScriptResponse,
    scalarSpecResponse,
  ]);
  if (scalarScript) expect(scalarScript.ok()).toBe(true);
  if (scalarSpec) {
    expect(scalarSpec.ok()).toBe(true);
    expect((await scalarSpec.json()).info.title).toBe("AIHUB API");
  }

  if ((await page.locator("#api-reference").count()) === 0)
    test.skip(true, "Scalar CDN script blocked in this environment");
  await expect(page.locator("#api-reference")).toHaveAttribute(
    "data-url",
    "/app/api/docs/openapi/v1.json"
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
    const response = await fetch("/app/api/docs/openapi/v1.json");
    return {
      status: response.status,
      disposition: response.headers.get("content-disposition"),
      document: await response.json(),
    };
  });
  expect(versionedDownload.status).toBe(200);
  expect(versionedDownload.disposition).toContain('filename="openapi-v1.json"');
  expect(versionedDownload.document.info.version).toMatch(/^1\.\d+\.\d+$/u);

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
  await page.goto("/app/docs");
  await expect(
    page.getByRole("heading", {
      name: "Đưa tính năng chấm AI vào ứng dụng của bạn",
    })
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Mở API Reference đầy đủ (cần đăng nhập)",
    })
  ).toHaveAttribute("href", "/app/docs/reference");

  await page.goto("/app/product/scoring/api/grade-task1");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(".aihub-path")).toContainText(
    "/v1/ielts/writing/task1/grade"
  );
});
