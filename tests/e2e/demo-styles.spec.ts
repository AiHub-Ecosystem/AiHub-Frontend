import { expect, test } from "@playwright/test";

/**
 * The demo pages share one stylesheet. Nothing else fails loudly when that
 * share breaks: the page still loads and still grades, it just loses its
 * layout. This is the check that the shared rules actually reach the page.
 */
test("the shared four-step workbench styles apply", async ({ page }) => {
  const failed: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") failed.push(m.text());
  });
  page.on("pageerror", (e) => failed.push(e.message));

  await page.goto("/demo/speaking");
  const root = page.locator("main.aihub-demo-flow");
  await expect(root).toBeVisible();

  await expect(page.locator(".demo-step-panel")).toBeVisible();
  await expect(page.locator(".demo-console")).toHaveCount(0);
  await page.getByRole("button", { name: "Xem câu hỏi mẫu" }).click();
  await page.getByRole("button", { name: "Tiếp tục đến câu trả lời" }).click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();
  await expect(page.locator(".demo-console")).toBeVisible();

  // The shared control rule.
  const btn = page.locator(".demo-btn-secondary").first();
  expect(await btn.evaluate((el) => getComputedStyle(el).borderRadius)).toBe(
    "9px"
  );

  // Shared trace panel and brand tokens.
  const console_ = page.locator(".demo-console");
  expect(
    await console_.evaluate((el) => getComputedStyle(el).backgroundColor)
  ).toBe("rgb(23, 26, 38)");

  const brand = await root.evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--demo-brand").trim()
  );
  expect(brand).toBe("#3a64fa");

  expect(failed, `console errors: ${failed.join(" | ")}`).toEqual([]);
});
