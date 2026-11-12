import { expect, test } from "@playwright/test";
import { waitForHydration } from "./hydration";

test("Home renders the landing with its own nav and hides the shared site chrome", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /chuẩn giám khảo/ })
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Chính" })).toBeVisible();
  // The mirror header and footer stay in the DOM but must not show.
  await expect(page.locator("header:not(.al-nav-bar)")).toBeHidden();
  await expect(page.locator("footer:not(.al-footer)")).toBeHidden();
});

test("Product tabs switch on click and on arrow keys", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  const tabs = page.getByRole("tablist", { name: "Sản phẩm" });
  await page
    .getByRole("button", { name: "Tạm dừng tự chuyển sản phẩm" })
    .click();

  await tabs.getByRole("tab", { name: /Chấm Speaking/ }).click();
  await expect(
    tabs.getByRole("tab", { name: /Chấm Speaking/ })
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tabpanel").getByRole("heading", { name: "Chấm Speaking" })
  ).toBeVisible();

  await page.keyboard.press("ArrowDown");
  await expect(tabs.getByRole("tab", { name: /Tạo bài tập/ })).toBeFocused();
  await expect(
    page.getByRole("tabpanel").getByRole("heading", { name: "Tạo bài tập" })
  ).toBeVisible();
});

test("Integration sample switches language", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  const samples = page.getByRole("tablist", { name: "Ngôn ngữ ví dụ" });
  await expect(page.getByText("curl -X POST", { exact: false })).toBeVisible();
  await samples.getByRole("tab", { name: "Python" }).click();
  await expect(page.getByText("import os, uuid, requests")).toBeVisible();
});
