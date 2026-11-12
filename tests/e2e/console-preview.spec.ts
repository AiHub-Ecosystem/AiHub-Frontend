import { expect, test } from "@playwright/test";
import { waitForHydration } from "./hydration";

test("Console prototype renders full-screen without the site chrome", async ({
  page,
}) => {
  await page.goto("/console/preview");
  await waitForHydration(page);
  const app = page.locator("[data-console-app]");
  await expect(app.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
  // The shared site header stays in the DOM but must not cover the console.
  await expect(page.locator("header .main-nav")).toBeHidden();
});

test("Console prototype navigates between pages and runs the demo grading", async ({
  page,
}) => {
  await page.goto("/console/preview");
  await waitForHydration(page);
  const app = page.locator("[data-console-app]");

  await app.getByRole("button", { name: "IELTS Writing" }).click();
  await expect(
    app.getByRole("heading", { name: /IELTS Writing/ })
  ).toBeVisible();
  // Service pages have their own <header>, which the mirror would pin to the
  // viewport on top of the title; inside the console it must flow.
  await expect(app.locator("header").first()).toHaveCSS("position", "static");
  await app.getByRole("button", { name: "Chấm chữa thử" }).click();
  await expect(app.getByText("Band 6.5")).toBeVisible();

  await app.getByRole("button", { name: "Gói & Credit" }).click();
  await expect(app.getByRole("heading", { name: "Gói dịch vụ" })).toBeVisible();
});

test("The real Console still requires a session", async ({ page }) => {
  await page.goto("/console");
  await expect(page).toHaveURL(/\/login\?next=%2Fconsole/);
});
