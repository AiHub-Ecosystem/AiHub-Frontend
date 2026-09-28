import { expect, test } from "@playwright/test";

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

test("Site header leads to the API reference and never to /specs", async ({
  page,
}) => {
  await page.goto("/");
  const header = page.locator("header");

  await expect(header.locator('a[href="/specs"]')).toHaveCount(0);

  await header.getByRole("link", { name: "Document" }).click();
  await expect(page).toHaveURL(/\/product$/);
});
