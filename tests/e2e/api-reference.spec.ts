import { expect, test } from "@playwright/test";

test("Exercise generation API reference shows its headers and errors", async ({
  page,
}) => {
  await page.goto("/product/exercise-generation/api/create-micro-exercise");

  await expect(page.locator("pre.aihub-code").first()).toContainText(
    `-H "Content-Type: application/json"`
  );

  const errors = page.locator("section", {
    has: page.getByRole("heading", { name: "Lỗi thường gặp" }),
  });
  await expect(errors).toContainText(
    "Áp dụng chung cho các endpoint sinh bài tập trong docs/doc-api-micro.md."
  );
  await expect(errors.locator(".aihub-status")).toHaveText([
    "200",
    "422",
    "404",
    "500",
  ]);
  await expect(errors.locator("article strong")).toHaveText([
    "Graceful fallback",
    "Sai quy tắc dữ liệu request",
    "Không đủ reference (chỉ sample-references)",
    "Lỗi server / LLM",
  ]);
});
