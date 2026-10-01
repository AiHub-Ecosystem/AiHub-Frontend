import { expect, test } from "@playwright/test";

const mockUrl = "http://127.0.0.1:3101";

test("Exercise Generation displays a reference from the local mock", async ({
  page,
  request,
}) => {
  const nonLocalRequests: string[] = [];

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") {
      nonLocalRequests.push(url.origin);
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto("/demo/exercise-generation");
  await page.getByLabel("Task 1", { exact: true }).check();
  await page.getByLabel("Topic").selectOption("environment");
  await page.getByLabel("Criteria").selectOption("task_achievement");
  await page.getByLabel("Error Code").selectOption("inappropriate_structure");
  await page
    .getByRole("button", { name: "Query reference", exact: true })
    .click();

  await expect(
    page.getByText("“E2E_ONLY_REFERENCE_PROMPT”", { exact: true })
  ).toBeVisible();

  const mockLog = await request.get(`${mockUrl}/__test__/requests`);
  expect(mockLog.ok()).toBe(true);
  const { requests } = await mockLog.json();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    writing_task: 1,
    topic: "environment",
    criterion: "task_achievement",
    error_code: "inappropriate_structure",
  });
  expect(nonLocalRequests).toEqual([]);
});
