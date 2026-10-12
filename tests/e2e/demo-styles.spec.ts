import { expect, test } from "@playwright/test";

/**
 * The demo pages share one stylesheet. Nothing else fails loudly when that
 * share breaks: the page still loads and still grades, it just loses its
 * layout. This is the check that the shared rules actually reach the page.
 */
test("shared workbench rules apply", async ({ page }) => {
  const failed: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") failed.push(m.text());
  });
  page.on("pageerror", (e) => failed.push(e.message));

  await page.goto("/demo/speaking");
  await expect(page.locator("main.aihub-demo")).toBeVisible();

  // A shell rule that only exists in the shared stylesheet. `100dvh` resolves
  // to pixels in computed style, so compare against the viewport height.
  const shell = page.locator(".app-shell").first();
  await expect(shell).toBeVisible();
  const minHeight = await shell.evaluate((el) =>
    parseFloat(getComputedStyle(el).minHeight)
  );
  const viewport = page.viewportSize()!.height;
  expect(minHeight).toBeGreaterThanOrEqual(viewport);

  // A shared control rule.
  const btn = page.locator(".btn").first();
  expect(await btn.evaluate((el) => getComputedStyle(el).borderRadius)).toBe(
    "7px"
  );

  // A speaking-only rule.
  const console_ = page.locator(".console").first();
  expect(
    await console_.evaluate((el) => getComputedStyle(el).backgroundColor)
  ).toBe("rgb(21, 21, 31)");

  // The criterion scale tokens must be defined on the shared root.
  const tokens = await page
    .locator("main.aihub-demo")
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return [
        s.getPropertyValue("--demo-criterion-achieve-bg").trim(),
        s.getPropertyValue("--demo-criterion-grammar-rule").trim(),
        s.getPropertyValue("--demo-brand").trim(),
      ];
    });
  expect(tokens[0]).toBe("#dcebff");
  expect(tokens[1]).toBe("#8a3fb0");
  expect(tokens[2]).toBeTruthy();

  expect(failed, `console errors: ${failed.join(" | ")}`).toEqual([]);
});
