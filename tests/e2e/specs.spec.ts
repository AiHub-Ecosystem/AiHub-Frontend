import { expect, test } from "@playwright/test";

test("Specs page builds cURL without executing requests through the BFF", async ({
  page,
  request,
}) => {
  const removedRouteCalls: string[] = [];

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/api/portal/specs/run-curl", async (route) => {
    removedRouteCalls.push(route.request().method());
    await route.fulfill({ status: 500 });
  });

  await page.goto("/specs");

  await expect(page).toHaveTitle("Universal AI Specs & cURL Builder — AIHub");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Tra cứu tài liệu API đa lĩnh vực, chỉnh sửa request mẫu và tạo lệnh cURL để chạy bên ngoài Customer Web. Trang này không thực thi request."
  );
  await expect(
    page.getByRole("heading", { name: "Universal Spec Hub & cURL Builder" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /cURL Builder/ }).last()
  ).toBeVisible();
  await expect(
    page.getByText("Sao chép lệnh cURL để chạy bên ngoài Customer Web.", {
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByText("Lệnh cURL Tự Sinh:", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy Full Spec" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Run Test|Chạy test/i })
  ).toHaveCount(0);
  await expect(page.getByText("GATEWAY READY", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/SCHEMA VALIDATED|SCHEMA MISMATCH/)).toHaveCount(
    0
  );

  const command = page
    .locator("pre")
    .filter({ hasText: "curl -X POST" })
    .last();
  await expect(command).toContainText("/ai/v1/legal/analyze-contract");

  await page.locator("textarea").first().fill("E2E_UPDATED_DOCUMENT");
  await expect(command).toContainText("E2E_UPDATED_DOCUMENT");

  await page.getByRole("button", { name: "Copy cURL" }).click();
  await expect(page.getByRole("button", { name: "✔ Đã Copy" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("E2E_UPDATED_DOCUMENT");

  expect(removedRouteCalls).toEqual([]);

  const removedRouteResponse = await request.post(
    "/api/portal/specs/run-curl",
    { data: { specId: "legal_contract_risk_analyzer", requestBody: {} } }
  );
  expect(removedRouteResponse.status()).toBe(404);
});
