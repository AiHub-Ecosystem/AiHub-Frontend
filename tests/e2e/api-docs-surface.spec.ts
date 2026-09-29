import { expect, test, type Locator } from "@playwright/test";
import { waitForHydration } from "./hydration";

test("Retired /specs redirects permanently to the API product catalog", async ({
  page,
  request,
}) => {
  const response = await request.get("/specs", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers()["location"]).toBe("/product");

  await page.goto("/specs");
  await expect(page).toHaveURL(/\/product$/);
});

test("Site header leads to the API product catalog and never to /specs", async ({
  page,
}) => {
  const header = page.locator("header");

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(header.locator('a[href="/specs"]')).toHaveCount(0);
  }

  await header.getByRole("link", { name: "Document" }).click();
  await expect(page).toHaveURL(/\/product$/);
});

const OPERATION_REFERENCES = [
  { name: "Writing Task 1", href: "/product/scoring/api/grade-task1" },
  { name: "Writing Task 2", href: "/product/scoring/api/grade-task2" },
  {
    name: "Speaking multipart",
    href: "/product/speaking/api/speaking-grading",
  },
  {
    name: "Speaking JSON-by-URL",
    href: "/product/speaking/api/speaking-grading-json",
  },
];

test("/docs opens with the identity decision and a Declared first call", async ({
  page,
}) => {
  await page.goto("/docs");

  const main = page.locator(".aihub-shell");
  const firstSection = main.locator("section").first();
  await expect(firstSection.getByRole("heading", { level: 2 })).toContainText(
    "mã người học"
  );
  await expect(firstSection).toContainText("X-User-Identity");
  await expect(firstSection).toContainText(
    "JWKS (bộ khóa xác minh) là tuỳ chọn"
  );

  const firstCall = firstSection.locator("pre.aihub-code").first();
  await expect(firstCall).toContainText("/v1/ielts/writing/task2/grade");
  await expect(firstCall).toContainText("Idempotency-Key");
  for (const field of ["question", "topic", "essay"]) {
    await expect(firstCall).toContainText(`"${field}"`);
  }
  await expect(firstCall).not.toContainText("aihub_sk_live");
});

test("/docs explains Declared trust and optional Signed setup", async ({
  page,
}) => {
  await page.goto("/docs");

  const identity = page.locator("#dinh-danh");
  await expect(identity).toContainText("1–256");
  await expect(identity).toContainText("ổn định");
  await expect(identity).toContainText("email");
  await expect(identity).toContainText(
    "PUT /v1/organizations/{organization_id}/identity-config"
  );
  await expect(identity).toContainText("owner");
  for (const term of [
    "RS256",
    "ES256",
    "kid",
    "aud",
    "sub",
    "jti",
    "iat",
    "exp",
  ]) {
    await expect(identity).toContainText(term);
  }
  await expect(identity).toContainText("INVALID_USER_IDENTITY");
});

test("/docs links each grading operation to its API reference page", async ({
  page,
}) => {
  await page.goto("/docs");

  for (const { name, href } of OPERATION_REFERENCES) {
    await expect(
      page.locator(`.aihub-shell a[href="${href}"]`).first(),
      name
    ).toBeVisible();
  }

  for (const { href } of OPERATION_REFERENCES) {
    await page.goto("/docs");
    await page.locator(`.aihub-shell a[href="${href}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator("pre.aihub-code").first()).toBeVisible();
  }
});

test("/docs separates Customer Sandbox from the demo assertion route", async ({
  page,
}) => {
  await page.goto("/docs");

  const sandbox = page.locator("#sandbox");
  await expect(sandbox).toContainText("sandbox.aihubproduction.com");
  await expect(sandbox).toContainText(
    "POST /v1/organizations/{organization_id}/api-keys"
  );
  await expect(sandbox).toContainText("writing.grade");
  await expect(sandbox).toContainText("25");
  await expect(sandbox).toContainText("500");
  await expect(sandbox).toContainText("POST /v1/sandbox/assertions");
  await expect(sandbox).toContainText("Organization demo");
  await expect(sandbox).not.toContainText("staging.");
});

test("/docs gives reliability guidance by operation and error", async ({
  page,
}) => {
  await page.goto("/docs");

  const reliability = page.locator("#do-tin-cay");
  await expect(reliability).toContainText("Speaking không có idempotency");
  await expect(reliability).toContainText("retry_after_ms");
  await expect(reliability).toContainText("meta.request_id");
  for (const code of [
    "USER_IDENTITY_REQUIRED",
    "INVALID_USER_IDENTITY",
    "RATE_LIMITED",
    "CONCURRENCY_LIMIT",
    "QUOTA_EXCEEDED",
    "IDENTITY_PROVIDER_UNAVAILABLE",
  ]) {
    await expect(
      reliability.locator("code", { hasText: code }).first()
    ).toBeVisible();
  }
  // The old guide filed a missing header under the wrong code.
  await expect(
    reliability.locator("tr", { hasText: "USER_IDENTITY_REQUIRED" })
  ).toContainText("401");
});

test("/docs offers no browser grading action and makes no AIHUB API request", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (/aihubproduction\.com/.test(new URL(request.url()).hostname))
      apiRequests.push(request.url());
  });
  await page.goto("/docs");
  await page.waitForLoadState("networkidle");

  const shell = page.locator(".aihub-shell");
  await expect(shell.locator("form, input, textarea")).toHaveCount(0);
  // The only controls are the copy buttons; none of them sends a request.
  const buttons = shell.getByRole("button");
  expect(await buttons.count()).toBeGreaterThan(0);
  for (const name of await buttons.evaluateAll((els) =>
    els.map((el) => el.getAttribute("aria-label"))
  )) {
    expect(name).toMatch(/^Sao chép: /);
  }
  expect(apiRequests).toEqual([]);
});

test("/docs code samples copy to the clipboard and announce it without moving the layout", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/docs");
  await waitForHydration(page);

  const block = page.locator(".aihub-codeblock").first();
  const bar = block.locator(".aihub-codeblock-bar");
  const heightBefore = (await bar.boundingBox())!.height;
  const offsetBefore = await gapBetweenBarAndCode(block);

  const copy = block.getByRole("button", { name: /^Sao chép: / });
  await copy.focus();
  await page.keyboard.press("Enter");

  await expect(block.getByRole("status")).toHaveText("Đã sao chép");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "/v1/ielts/writing/task2/grade"
  );
  expect((await bar.boundingBox())!.height).toBe(heightBefore);
  expect(await gapBetweenBarAndCode(block)).toBe(offsetBefore);

  await expect(block.getByRole("status")).toHaveText("", { timeout: 5000 });
});

test("/docs shows how to sign an assertion in Node.js, Python and Java", async ({
  page,
}) => {
  await page.goto("/docs");

  const signed = page.locator("#dinh-danh");
  for (const language of ["Node.js", "Python", "Java"]) {
    await expect(
      signed.getByRole("button", {
        name: `Sao chép: ${language}: ký Signed User Assertion`,
      })
    ).toBeVisible();
  }
  const samples = signed.locator("pre.aihub-code");
  await expect(samples.filter({ hasText: '"aud": "aihub"' })).toHaveCount(1);
  await expect(samples.filter({ hasText: ".audience(" })).toHaveCount(1);
  await expect(samples.filter({ hasText: ".setAudience(" })).toHaveCount(1);
  // Placeholders only: no key material ships in the page.
  await expect(signed).not.toContainText("BEGIN PRIVATE KEY");
});

test("/docs stays inside a phone viewport and is keyboard reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs");
  // CI renders monospace wider than a dev machine; widen it here so an
  // unbreakable path in running text fails locally too, not only on CI.
  await page.addStyleTag({
    content: "code, pre { font-size: 1.25em !important; }",
  });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const toc = page.getByRole("navigation", { name: "Trong trang" });
  const link = toc.getByRole("link", { name: "Thử miễn phí" });
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#sandbox$/);
  await expect(page.locator("#sandbox")).toBeInViewport();
});

test("/docs anchors land below the site header, one per identity mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs");

  for (const id of ["declared", "signed", "sandbox", "do-tin-cay"]) {
    await page.evaluate((hash) => (location.hash = hash), id);
    const target = page.locator(`#${id}`);
    await expect(target).toBeInViewport();
    const headerBottom = await page
      .locator("header")
      .first()
      .evaluate((el) => el.getBoundingClientRect().bottom);
    const targetTop = await target.evaluate(
      (el) => el.getBoundingClientRect().top
    );
    expect(targetTop, `#${id} hidden by header`).toBeGreaterThanOrEqual(
      headerBottom - 1
    );
  }

  // The Signed snippet changes only the identity header's value.
  await expect(
    page.getByLabel("Header X-User-Identity ở dạng ký", { exact: true })
  ).toContainText("SIGNED_USER_ASSERTION");
});

/** Distance from the copy bar to its code: unchanged unless the layout moved. */
async function gapBetweenBarAndCode(block: Locator) {
  const bar = (await block.locator(".aihub-codeblock-bar").boundingBox())!;
  const code = (await block.locator("pre").boundingBox())!;
  return code.y - bar.y;
}
