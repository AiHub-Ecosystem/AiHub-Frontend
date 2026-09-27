import { expect, test, type Page } from "@playwright/test";

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

const WRITING_ERROR_STATUSES = [
  "400",
  "401",
  "401",
  "401",
  "403",
  "403",
  "404",
  "409",
  "413",
  "429",
  "429",
  "429",
  "500",
  "502",
  "502",
  "503",
  "503",
  "503",
  "504",
];

const WRITING_ERROR_CODES = [
  "INVALID_REQUEST",
  "UNAUTHORIZED",
  "USER_IDENTITY_REQUIRED",
  "INVALID_USER_IDENTITY",
  "FORBIDDEN",
  "ENVIRONMENT_NOT_ALLOWED",
  "NOT_FOUND",
  "IDEMPOTENCY_CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "CONCURRENCY_LIMIT",
  "QUOTA_EXCEEDED",
  "INTERNAL_ERROR",
  "AI_SERVICE_ERROR",
  "AI_SERVICE_CONTRACT_VIOLATION",
  "AI_SERVICE_THROTTLED",
  "AI_SERVICE_UNAVAILABLE",
  "IDENTITY_PROVIDER_UNAVAILABLE",
  "AI_SERVICE_TIMEOUT",
];

const CHART_TYPES = [
  "Bar Chart",
  "Line Graph",
  "Pie Chart",
  "Table",
  "Map",
  "Process Diagram",
  "Multiple Graphs",
];

const WRITING_CURL_HEADERS = [
  `-H "X-API-Key: $AIHUB_API_KEY"`,
  `-H "X-User-Identity: $AIHUB_USER_IDENTITY"`,
  `-H "Idempotency-Key: $AIHUB_IDEMPOTENCY_KEY"`,
  `-H "Content-Type: application/json"`,
];

/** The Request tab is the default tab; the first pre is the request example. */
const requestExample = (page: Page) => page.locator("pre.aihub-code").first();

/** The Response tab must be opened before its example is rendered. */
async function showResponse(page: Page) {
  await page.getByRole("tab", { name: "Response" }).click();
  return page.locator("pre.aihub-code").first();
}

const requestFields = (page: Page) =>
  page.locator("table.aihub-schema tbody tr td:first-child");

const errorSection = (page: Page) =>
  page.locator("section", {
    has: page.getByRole("heading", { name: "Lỗi thường gặp" }),
  });

/** The contract fixes `criteria` at exactly four entries, in a fixed order. */
const countCriteria = (body: string | null) =>
  (body ?? "").split('"id": "').length - 1;

test("Writing Scoring is stable and links both grading operations", async ({
  page,
}) => {
  await page.goto("/product/scoring");

  await expect(page.locator(".aihub-badge")).toHaveText("Stable");
  const links = page.locator('a[href^="/product/scoring/api/"]');
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute(
    "href",
    "/product/scoring/api/grade-task1"
  );
  await expect(links.nth(1)).toHaveAttribute(
    "href",
    "/product/scoring/api/grade-task2"
  );
  await expect(page.locator(".aihub-path")).toHaveText([
    "/v1/ielts/writing/task1/grade",
    "/v1/ielts/writing/task2/grade",
  ]);
});

test("Writing Scoring overview names the production host and its requirements", async ({
  page,
}) => {
  await page.goto("/product/scoring");

  const facts = page.locator(".aihub-facts");
  await expect(facts).toContainText("api.aihubproduction.com");
  await expect(facts).toContainText("writing.grade");
  await expect(facts).toContainText("X-User-Identity");
});

test("Writing Task 1 reference shows the request contract and image placeholder", async ({
  page,
}) => {
  await page.goto("/product/scoring/api/grade-task1");

  const request = requestExample(page);
  for (const header of WRITING_CURL_HEADERS) {
    await expect(request).toContainText(header);
  }
  await expect(request).toContainText(`AIHUB_IDEMPOTENCY_KEY="$(uuidgen)"`);
  await expect(request).toContainText("https://api.aihubproduction.com");
  await expect(request).toContainText(`"chart_type": "Bar Chart"`);

  await expect(requestFields(page)).toHaveText([
    "question",
    "chart_type",
    "essay",
    "image_url",
    "language",
  ]);
  for (const chartType of CHART_TYPES) {
    await expect(page.locator("table.aihub-schema")).toContainText(chartType);
  }
  await expect(page.locator(".aihub-notes")).toContainText("URL giữ chỗ");
});

test("Writing Task 1 reference shows four ordered criteria in the response", async ({
  page,
}) => {
  await page.goto("/product/scoring/api/grade-task1");

  const response = await showResponse(page);
  await expect(response).toContainText(/"overall_band": 6\.5/);
  await expect(response).toContainText(/"request_id": "req_/);
  await expect(response).toContainText(/"service": "writing"/);
  await expect(response).toContainText(/"operation": "writing\.task1\.grade"/);
  await expect(response).toContainText(/"total_ms": \d+/);
  expect(countCriteria(await response.textContent())).toBe(4);
  await expect(response).toContainText(
    /"id": "task_achievement"[\s\S]*"id": "coherence_cohesion"[\s\S]*"id": "lexical_resource"[\s\S]*"id": "grammatical_range_accuracy"/
  );
});

test("Writing Task 2 reference requires topic and grades task response", async ({
  page,
}) => {
  await page.goto("/product/scoring/api/grade-task2");

  const request = requestExample(page);
  for (const header of WRITING_CURL_HEADERS) {
    await expect(request).toContainText(header);
  }
  await expect(request).toContainText(`"topic"`);

  await expect(requestFields(page)).toHaveText([
    "question",
    "topic",
    "essay",
    "language",
  ]);
  await expect(
    page.locator("table.aihub-schema tr", { hasText: "topic" })
  ).toContainText("BẮT BUỘC");

  const response = await showResponse(page);
  expect(countCriteria(await response.textContent())).toBe(4);
  await expect(response).toContainText(
    /"id": "task_response"[\s\S]*"id": "coherence_cohesion"[\s\S]*"id": "lexical_resource"[\s\S]*"id": "grammatical_range_accuracy"/
  );
});

test("Writing Scoring shows all nineteen gateway errors grouped by status", async ({
  page,
}) => {
  await page.goto("/product/scoring/api/grade-task2");

  const errors = errorSection(page);
  await expect(errors.locator(".aihub-status")).toHaveText(
    WRITING_ERROR_STATUSES
  );
  await expect(errors.locator("article code")).toHaveText(WRITING_ERROR_CODES);

  // Status và code phải đi cặp: đảo hai mã cho khác status vẫn phải đỏ.
  const heads = (
    await errors.locator("article .aihub-endpoint-head").allTextContents()
  ).map((text) => text.trim());
  heads.forEach((head, i) => {
    expect(
      head.startsWith(`${WRITING_ERROR_STATUSES[i]}${WRITING_ERROR_CODES[i]}`)
    ).toBe(true);
  });

  // retry_after_ms phải nằm trong payload thật, không chỉ trong lời dẫn.
  await expect(
    errors.locator("article", { hasText: "RATE_LIMITED" }).locator("pre")
  ).toContainText('"retry_after_ms": 2000');
  await expect(errors).toContainText("JWKS");
});
