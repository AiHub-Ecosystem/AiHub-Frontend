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

test("Writing Task 1 reference shows the request contract and AIHUB's published chart", async ({
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
  // The example is shared with the Console, so its key order is contract:
  // it decides the order the fields are rendered and sent in.
  await expect(request).toContainText(
    /"question":[\s\S]*"chart_type":[\s\S]*"image_url":[\s\S]*"essay":/
  );

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
  await expect(request).toContainText(
    `"image_url": "https://s3.wispace.app/ielts-task1/ca95bd4ab522946d"`
  );
  const notes = page.locator(".aihub-notes");
  await expect(notes).not.toContainText("URL giữ chỗ");
  await expect(notes).toContainText("biểu đồ mẫu AIHUB công bố");
  // The published chart is AIHUB's example, not the reader's.
  await expect(notes).toContainText("thay bằng ảnh biểu đồ của bạn");
  await expect(notes).toContainText("kết quả sẽ sai");
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
  const quota = errors.locator("article", { hasText: "QUOTA_EXCEEDED" });
  await expect(quota.locator("pre")).toContainText('"retryable": true');
  await expect(quota.locator("pre")).toContainText('"retry_after_ms":');
  const conflict = errors.locator("article", {
    hasText: "IDEMPOTENCY_CONFLICT",
  });
  await expect(conflict.locator("pre")).toContainText('"retryable": false');
  await expect(conflict).toContainText("chờ nó xong");
  const aiServiceError = errors.locator("article", {
    hasText: "AI_SERVICE_ERROR",
  });
  await expect(aiServiceError).toContainText("4xx");
  await expect(aiServiceError).toContainText("5xx");
  await expect(
    errors
      .locator("article", { hasText: "AI_SERVICE_THROTTLED" })
      .locator("pre")
  ).not.toContainText('"retry_after_ms"');
  await expect(
    errors.locator("article", {
      hasText: "IDENTITY_PROVIDER_UNAVAILABLE",
    })
  ).toContainText("Identity configuration");
  await expect(errors).toContainText("JWKS");
});

const SPEAKING_CURL_HEADERS = [
  `-H "X-API-Key: $AIHUB_API_KEY"`,
  `-H "X-User-Identity: $AIHUB_USER_IDENTITY"`,
];

/** The endpoint's own notes; the retry policy reuses the same list style. */
const endpointNotes = (page: Page) => page.locator(".aihub-notes").first();

const SPEAKING_ERROR_STATUSES = [
  "400",
  "401",
  "401",
  "401",
  "403",
  "403",
  "404",
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

const SPEAKING_ERROR_CODES = [
  "INVALID_REQUEST",
  "UNAUTHORIZED",
  "USER_IDENTITY_REQUIRED",
  "INVALID_USER_IDENTITY",
  "FORBIDDEN",
  "ENVIRONMENT_NOT_ALLOWED",
  "NOT_FOUND",
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

/**
 * The guard that keeps the catalog honest for every product, not just
 * Speaking: a missing reference shows up as an inert card instead of a link.
 */
for (const slug of ["exercise-generation", "scoring", "speaking"]) {
  test(`every ${slug} endpoint has a reference page`, async ({ page }) => {
    await page.goto(`/product/${slug}`);

    const cards = page.locator(".aihub-endpoint");
    const links = page.locator(`a[href^="/product/${slug}/api/"]`);
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
    expect(await links.count()).toBe(cardCount);
  });
}

test("every Speaking endpoint in the catalog has a reference page", async ({
  page,
}) => {
  await page.goto("/product/speaking");

  const links = page.locator('a[href^="/product/speaking/api/"]');
  await expect(links).toHaveCount(3);
  await expect(links.nth(0)).toHaveAttribute(
    "href",
    "/product/speaking/api/speaking-questions"
  );
  await expect(links.nth(1)).toHaveAttribute(
    "href",
    "/product/speaking/api/speaking-grading"
  );
  await expect(links.nth(2)).toHaveAttribute(
    "href",
    "/product/speaking/api/speaking-grading-json"
  );
  await expect(page.locator(".aihub-path")).toHaveText([
    "/v1/ielts/speaking/questions?part={part}",
    "/v1/ielts/speaking/grading",
    "/v1/ielts/speaking/grading-json",
  ]);
});

test("Speaking overview names the production host and the required key scope", async ({
  page,
}) => {
  await page.goto("/product/speaking");

  const facts = page.locator(".aihub-facts");
  await expect(facts).toContainText("api.aihubproduction.com");
  await expect(facts).toContainText("speaking.grade");
});

test("Speaking grading reference builds a multipart request, not a JSON body", async ({
  page,
}) => {
  await page.goto("/product/speaking/api/speaking-grading");

  const request = requestExample(page);
  for (const header of SPEAKING_CURL_HEADERS) {
    await expect(request).toContainText(header);
  }
  await expect(request).toContainText("https://api.aihubproduction.com");
  await expect(request).toContainText('-F "audio=@${AIHUB_AUDIO_FILE}"');
  // A hand-written multipart content type drops the boundary curl generates.
  await expect(request).not.toContainText("Content-Type");
  await expect(request).not.toContainText(" -d ");
  // This operation has no idempotency key, so the header must not appear.
  await expect(request).not.toContainText("Idempotency-Key");
});

/**
 * The field table and the generated command are one source, so every field the
 * table documents must appear in the command — including the optional ones,
 * which is where a silent omission would hide.
 */
test("Speaking grading command sends every documented field", async ({
  page,
}) => {
  await page.goto("/product/speaking/api/speaking-grading");

  const request = requestExample(page);
  const fields = await requestFields(page).allTextContents();
  expect(fields).toEqual([
    "audio",
    "part",
    "question_id",
    "prompt_text",
    "test_type",
    "test_code",
    "transcript",
  ]);
  for (const field of fields) {
    await expect(request).toContainText(`-F "${field}=`);
  }
  await expect(request).toContainText('-F "part=1"');
  await expect(request).toContainText(
    '-F "question_id=p1_do-you-enjoy-living-in-your-city-or-hometown"'
  );
  await expect(request).toContainText('-F "test_type=Practice"');
  await expect(request).toContainText(
    '-F "prompt_text=Do you enjoy living in your city or hometown?"'
  );
  await expect(request).toContainText('-F "test_code=ielts-practice-01"');
  // A documented field with no value would render an empty argument.
  await expect(request).not.toContainText('-F "transcript="');
});

test("Speaking published answer sample uses its stable URL in a JSON body", async ({
  page,
}) => {
  await page.goto("/product/speaking/api/speaking-grading-json");

  const request = requestExample(page);
  for (const header of SPEAKING_CURL_HEADERS) {
    await expect(request).toContainText(header);
  }
  // Without this the command would be sent as x-www-form-urlencoded.
  await expect(request).toContainText('-H "Content-Type: application/json"');
  await expect(request).toContainText("https://api.aihubproduction.com");
  await expect(request).toContainText(
    '"audio_url": "https://s3.wispace.app/ielts-task1/speaking-answers/part-1/do-you-enjoy-living-in-your-city-or-hometown.webm"'
  );
  await expect(request).not.toContainText(/"audio_url": "[^"]*\?/);
  await expect(request).not.toContainText("aihub-speaking-samples");
  await expect(request).toContainText('"part": 1');
  await expect(request).toContainText(
    '"question_id": "p1_do-you-enjoy-living-in-your-city-or-hometown"'
  );
  await expect(request).toContainText(
    '"prompt_text": "Do you enjoy living in your city or hometown?"'
  );
  await expect(request).not.toContainText(" -F ");
  await expect(request).not.toContainText("Idempotency-Key");
  // A transcript that is not in the recording would be graded instead of it.
  await expect(request).not.toContainText('"transcript"');
  await expect(request).not.toContainText('"test_code"');
  const response = await showResponse(page);
  expect(response).toBeTruthy();
});

test("Speaking grading reference marks fields as the contract does", async ({
  page,
}) => {
  await page.goto("/product/speaking/api/speaking-grading");

  await expect(requestFields(page)).toHaveText([
    "audio",
    "part",
    "question_id",
    "prompt_text",
    "test_type",
    "test_code",
    "transcript",
  ]);
  const optional = page.locator("table.aihub-schema tbody tr");
  for (const field of ["prompt_text", "test_type", "test_code", "transcript"]) {
    await expect(optional.filter({ hasText: field })).toContainText("tuỳ chọn");
  }
  for (const field of ["audio", "part", "question_id"]) {
    await expect(optional.filter({ hasText: field })).toContainText("BẮT BUỘC");
  }
});

test("Speaking grading warns that a retry starts another billed run", async ({
  page,
}) => {
  await page.goto("/product/speaking/api/speaking-grading");

  const notes = endpointNotes(page);
  await expect(notes).toContainText("không có idempotent");
  await expect(notes).toContainText("Idempotency-Key");
  await expect(notes).toContainText("lần chấm mới");
});

test("Speaking questions reference carries no User Identity header", async ({
  page,
}) => {
  await page.goto("/product/speaking/api/speaking-questions");

  const request = requestExample(page);
  await expect(request).not.toContainText("X-User-Identity");
  await expect(request).not.toContainText("X-API-Key");
  await expect(request).toContainText(
    "https://api.aihubproduction.com/v1/ielts/speaking/questions?part="
  );
  await expect(endpointNotes(page)).toContainText("không phải");
});

test("Speaking questions response example names real Speaking questions with signed answer audio", async ({
  page,
}) => {
  await page.goto("/product/speaking/api/speaking-questions");

  const response = await showResponse(page);
  await expect(response).toContainText(
    /"question_id": "p1_do-you-enjoy-living-in-your-city-or-hometown"/
  );
  await expect(response).toContainText(
    /"question_id": "p1_how-often-do-you-use-public-transport"/
  );
  // The real audio_url is a signed object URL, not a permanent one.
  await expect(response).toContainText(
    /"audio_url": "https:\/\/s3\.wispace\.app\/aihub-speaking-samples\/speaking-samples\/part-1\/do-you-enjoy-living-in-your-city-or-hometown\.webm\?/
  );
  await expect(response).toContainText(/X-Amz-Expires=900/);
  await expect(response).toContainText(/"part": 1/);
});

test("Speaking questions documents its answer audio and short-lived URL", async ({
  page,
}) => {
  await page.goto("/product/speaking/api/speaking-questions");

  const notes = endpointNotes(page);
  await expect(notes).toContainText("bản ghi câu trả lời mẫu tương ứng");
  await expect(notes).toContainText("có thể gửi tới grading-json");
  await expect(notes).toContainText("15 phút");
  await expect(notes).not.toContainText("giám khảo đọc câu hỏi");
  // The catalog example is real data, so the grading pages' "illustrative"
  // note does not belong here.
  await expect(notes).not.toContainText("minh hoạ");
});

test("Speaking URL fallback states the host AIHUB will accept", async ({
  page,
}) => {
  await page.goto("/product/speaking/api/speaking-grading-json");

  await expect(requestFields(page)).toHaveText([
    "audio_url",
    "part",
    "question_id",
    "prompt_text",
    "test_type",
    "test_code",
    "transcript",
  ]);
  await expect(endpointNotes(page)).toContainText("s3.wispace.app");
});

test("Speaking lists the failures AIHUB can return and the shared retry policy", async ({
  page,
}) => {
  await page.goto("/product/speaking/api/speaking-grading");

  const errors = errorSection(page);
  // The idempotency conflict is raised only by a Writing grade.
  await expect(
    errors.locator("article", { hasText: "IDEMPOTENCY_CONFLICT" })
  ).toHaveCount(0);
  await expect(errors.locator(".aihub-status")).toHaveText(
    SPEAKING_ERROR_STATUSES
  );
  await expect(errors.locator("article code")).toHaveText(SPEAKING_ERROR_CODES);

  // Status và code phải đi cặp: đảo hai mã cho khác status vẫn phải đỏ.
  const heads = (
    await errors.locator("article .aihub-endpoint-head").allTextContents()
  ).map((text) => text.trim());
  expect(heads).toHaveLength(18);
  heads.forEach((head, i) => {
    expect(
      head.startsWith(`${SPEAKING_ERROR_STATUSES[i]}${SPEAKING_ERROR_CODES[i]}`)
    ).toBe(true);
  });

  await expect(errors).toContainText("Chính sách retry");
  await expect(errors).toContainText("retryable");
});

test("Speaking questions shows only the failures it can return", async ({
  page,
}) => {
  await page.goto("/product/speaking/api/speaking-questions");

  const errors = errorSection(page);
  await expect(errors.locator("article code")).toHaveText([
    "INVALID_REQUEST",
    "INTERNAL_ERROR",
  ]);
  // The grading-only failures cannot come back from an unguarded GET.
  await expect(
    errors.locator("article", { hasText: "USER_IDENTITY_REQUIRED" })
  ).toHaveCount(0);
  await expect(errors.locator("article", { hasText: "FORBIDDEN" })).toHaveCount(
    0
  );
  await expect(errors).not.toContainText("Chính sách retry");
});

test("Speaking example values are labelled as illustrative", async ({
  page,
}) => {
  await page.goto("/product/speaking/api/speaking-grading");

  await expect(endpointNotes(page)).toContainText("minh hoạ");
});

test("Speaking operations state their own body limit and timeout", async ({
  page,
}) => {
  await page.goto("/product/speaking/api/speaking-grading");
  await expect(endpointNotes(page)).toContainText("26 MiB");
  await expect(endpointNotes(page)).toContainText("60 giây");
  await expect(endpointNotes(page)).toContainText("tối thiểu 90 giây");
  await expect(endpointNotes(page)).not.toContainText("256 KB");

  await page.goto("/product/speaking/api/speaking-grading-json");
  await expect(endpointNotes(page)).toContainText("256 KB");
  await expect(endpointNotes(page)).toContainText("30 giây");
  await expect(endpointNotes(page)).toContainText("tối thiểu 60 giây");
  await expect(endpointNotes(page)).not.toContainText("26 MiB");
});
