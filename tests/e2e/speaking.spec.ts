import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { waitForHydration } from "./hydration";

const mockUrl = "http://127.0.0.1:3101";
const sandboxKey = "aihub_sk_e2e_sandbox_key";

type SpeakingRequest = {
  operation: string;
  userIdentity: string | null;
  identityHeaderNames: string[];
};

type SpeakingLog = {
  requests: SpeakingRequest[];
  assertions: string[];
};

async function resetSpeakingLog(request: APIRequestContext) {
  const response = await request.post(`${mockUrl}/__test__/speaking/reset`);
  expect(response.ok()).toBe(true);
}

async function speakingLog(request: APIRequestContext) {
  const response = await request.get(`${mockUrl}/__test__/speaking/requests`);
  expect(response.ok()).toBe(true);
  return (await response.json()) as SpeakingLog;
}

function expectIdentityForwarding(log: SpeakingLog) {
  expect(log.assertions).toHaveLength(0);
  for (const grading of log.requests) {
    expect(grading.userIdentity).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(grading.identityHeaderNames).toEqual(["x-user-identity"]);
  }
}

async function keepBrowserTrafficLocal(page: Page) {
  let unexpectedExternalRequest = false;
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") {
      await route.continue();
      return;
    }
    if (url.hostname === "s3.wispace.app") {
      await route.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        body: Buffer.alloc(2048),
      });
      return;
    }
    unexpectedExternalRequest = true;
    await route.abort();
  });
  return () => expect(unexpectedExternalRequest).toBe(false);
}

async function startLiveSession(page: Page) {
  await waitForHydration(page);
  await page.getByLabel("API key Sandbox (tùy chọn)").fill(sandboxKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();
  await expect(
    page.getByRole("heading", { name: "Chọn câu hỏi Speaking" })
  ).toBeVisible();
  await expect(page.getByText("E2E_ONLY_QUESTION_1")).toBeVisible();
}

async function prepareLiveGrading(page: Page) {
  await startLiveSession(page);
  await page.getByRole("button", { name: "Tiếp tục đến câu trả lời" }).click();
  await page.getByTestId("input-audio-file").setInputFiles({
    name: "e2e-answer.wav",
    mimeType: "audio/wav",
    buffer: Buffer.alloc(2048, 1),
  });
  await page.getByRole("button", { name: "Xem bước chấm" }).click();
}

async function submitLiveGrading(page: Page) {
  await page.getByRole("button", { name: "Chấm thật Part 1" }).click();
  await expect(
    page.getByRole("region", { name: "Kết quả chấm Speaking" })
  ).toBeVisible({ timeout: 30_000 });
}

test.beforeEach(async ({ request }) => {
  await resetSpeakingLog(request);
});

test("Speaking without a key uses a read-only fixture and grades locally", async ({
  page,
  request,
}) => {
  const expectNoExternalRequests = await keepBrowserTrafficLocal(page);
  await page.goto("/demo/speaking");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Bỏ qua, dùng mẫu" }).click();

  await expect(
    page.getByRole("heading", { name: "Chọn câu hỏi Speaking" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục đến câu trả lời" }).click();
  await expect(page.locator("textarea[readonly]")).toBeVisible();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();
  await page.getByRole("button", { name: "Hiện kết quả mẫu Part 1" }).click();

  await expect(
    page.getByRole("region", { name: "Kết quả chấm Speaking" })
  ).toBeVisible();
  await page.getByRole("tab", { name: "Response" }).click();
  await expect(page.locator(".demo-console-code")).toContainText(
    "local fixture"
  );

  const log = await speakingLog(request);
  expect(log.requests).toHaveLength(0);
  expect(log.assertions).toHaveLength(0);
  expectNoExternalRequests();
});

test("live Speaking never falls back to fixture questions when the catalog is unavailable", async ({
  page,
  request,
}) => {
  const expectNoExternalRequests = await keepBrowserTrafficLocal(page);
  await page.route(/\/api\/demo\/speaking\/questions\?part=1$/, (route) =>
    route.fulfill({ status: 200, json: { data: { questions: [] } } })
  );
  await page.route(/\/api\/demo\/speaking\/questions\?part=2$/, (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "AI_SERVICE_UNAVAILABLE",
          message: "Sandbox unavailable.",
        },
      },
    })
  );

  await page.goto("/demo/speaking");
  await waitForHydration(page);
  await page.getByLabel("API key Sandbox (tùy chọn)").fill(sandboxKey);
  await page.getByRole("button", { name: "Kiểm tra key" }).click();
  await expect(
    page.getByRole("heading", { name: "Chọn câu hỏi Speaking" })
  ).toBeVisible();
  const questionError = page.locator('.demo-error[role="alert"]');
  await expect(questionError).toContainText("Sandbox hiện không có câu hỏi");
  await expect(page.locator(".demo-scenario-list button")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Tiếp tục đến câu trả lời" })
  ).toBeDisabled();

  await page.getByRole("button", { name: "Part 2" }).click();
  await expect(questionError).toContainText(
    "Không tải được câu hỏi Speaking từ Sandbox."
  );
  await page
    .getByRole("navigation", { name: "Các bước demo" })
    .getByRole("button", { name: /Chấm và xem kết quả/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Chấm thật Part 2" })
  ).toBeDisabled();

  const log = await speakingLog(request);
  expect(log.requests).toHaveLength(0);
  expectNoExternalRequests();
});

test("live Speaking grading forwards the temporary demo UUID", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const expectNoExternalRequests = await keepBrowserTrafficLocal(page);
  await page.goto("/demo/speaking");
  await prepareLiveGrading(page);
  await submitLiveGrading(page);

  const log = await speakingLog(request);
  expect(log.requests).toHaveLength(1);
  expect(log.requests[0].operation).toBe("grading");
  expectIdentityForwarding(log);
  expectNoExternalRequests();
});

test("Speaking grading rejects an invalid key if the client bypasses validation", async ({
  page,
  request,
}) => {
  await page.goto("/demo/speaking");
  await startLiveSession(page);

  const result = await page.evaluate(async () => {
    const form = new FormData();
    form.append(
      "audio",
      new File([new Uint8Array(2048)], "e2e-answer.wav", { type: "audio/wav" })
    );
    form.append("part", "1");
    form.append("question_id", "q_part1_1");
    form.append("prompt_text", "Do you enjoy living in your hometown?");
    form.append("test_type", "Practice");

    const response = await fetch("/api/demo/speaking/grading", {
      method: "POST",
      headers: {
        "X-Demo-API-Key": "invalid-sandbox-key",
        "X-Demo-User-Identity": "00000000-0000-4000-8000-000000000001",
      },
      body: form,
    });
    return { status: response.status, body: await response.json() };
  });

  expect(result.status).toBe(401);
  expect(result.body).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  const log = await speakingLog(request);
  expect(log.requests).toHaveLength(0);
  expect(log.assertions).toHaveLength(0);
});

test("live Speaking reuses the temporary UUID for the demo session", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const expectNoExternalRequests = await keepBrowserTrafficLocal(page);
  await page.goto("/demo/speaking");
  await prepareLiveGrading(page);
  await submitLiveGrading(page);

  await page.getByRole("button", { name: "Sửa câu trả lời" }).click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();
  await submitLiveGrading(page);

  const log = await speakingLog(request);
  expect(log.requests).toHaveLength(2);
  expect(log.requests.map((entry) => entry.operation)).toEqual([
    "grading",
    "grading",
  ]);
  expectIdentityForwarding(log);
  expect(log.requests[0].userIdentity).toBe(log.requests[1].userIdentity);
  expectNoExternalRequests();
});
