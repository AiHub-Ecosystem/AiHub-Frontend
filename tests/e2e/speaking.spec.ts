import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { waitForHydration } from "./hydration";

const mockUrl = "http://127.0.0.1:3101";
const sandboxKey = "aihub_sk_e2e_sandbox_key";
const signedSandboxKey = "aihub_sk_e2e_signed_sandbox_key";

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

async function startLiveSession(page: Page, apiKey = sandboxKey) {
  await waitForHydration(page);
  await page.getByLabel("Mã API (không bắt buộc)").fill(apiKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  await expect(
    page.getByRole("heading", { name: "Chọn câu hỏi Speaking" })
  ).toBeVisible();
  if (apiKey === signedSandboxKey) {
    await expect(
      page.getByLabel("URL endpoint cấp assertion (HTTPS)")
    ).toBeEnabled();
    await page.getByText("Nhập assertion thủ công").click();
    await expect(
      page.getByLabel("Signed User Assertion (JWT) (X-User-Identity)")
    ).toBeEnabled();
  } else {
    await expect(
      page.getByLabel("Declared User ID (X-User-Identity)")
    ).toBeEnabled();
  }
  await expect(page.getByText("Đã kiểm tra mã · có thể sửa bài")).toBeVisible();
  await expect(
    page.locator(".demo-scenario-list").getByText("E2E_ONLY_QUESTION_1")
  ).toBeVisible();
  await expect(
    page.getByText(
      apiKey === signedSandboxKey
        ? /Mã API đã được xác nhận\. Lấy assertion từ endpoint/
        : /Mã API đã được xác nhận\. Bạn có thể đổi Declared User ID ở trên/
    )
  ).toBeVisible();
  await page
    .locator(".demo-scenario-list")
    .getByText("E2E_ONLY_QUESTION_1")
    .click();
}

async function prepareLiveGrading(
  page: Page,
  apiKey = sandboxKey,
  identity?: string
) {
  await startLiveSession(page, apiKey);
  if (identity) {
    await page
      .getByLabel("Signed User Assertion (JWT) (X-User-Identity)")
      .fill(identity);
  }
  await page.getByRole("button", { name: "Tiếp tục đến câu trả lời" }).click();
  await expect(
    page.getByText(
      /Câu trả lời ghi âm mẫu đã có sẵn|Chọn tệp ghi âm hoặc tự ghi âm câu trả lời/
    )
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Chọn tệp ghi âm", exact: true })
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Ghi âm", exact: true })
  ).toBeEnabled();
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

test("live Speaking forwards a signed assertion and redacts both trace tabs", async ({
  page,
  request,
}) => {
  const expectNoExternalRequests = await keepBrowserTrafficLocal(page);
  const assertion = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTQyIn0.signature";
  await page.goto("/demo/speaking");
  await prepareLiveGrading(page, signedSandboxKey, assertion);

  const identity = page.getByLabel(
    "Signed User Assertion (JWT) (X-User-Identity)"
  );
  await expect(identity).toHaveValue(assertion);
  await expect(identity).toHaveAttribute("type", "password");
  const trace = page.locator(".demo-console .demo-console-code");
  await expect(trace).toContainText("<redacted signed user assertion>");
  await expect(trace).not.toContainText(assertion);

  await submitLiveGrading(page);
  const log = await speakingLog(request);
  expect(log.requests).toHaveLength(1);
  expect(log.requests[0].userIdentity).toBe(assertion);
  expect(log.requests[0].identityHeaderNames).toEqual(["x-user-identity"]);

  await page.getByRole("tab", { name: "Kết quả nhận được" }).click();
  await expect(trace).not.toContainText(assertion);
  expectNoExternalRequests();
});

test("an invalid Speaking assertion stays in the field and does not show a sample result", async ({
  page,
  request,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/speaking");
  await prepareLiveGrading(page, signedSandboxKey, "expired.e2e.assertion");
  await page.getByRole("button", { name: "Chấm thật Part 1" }).click();

  await expect(page.getByText(/User Identity không hợp lệ/)).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Kết quả chấm Speaking" })
  ).toHaveCount(0);
  const identity = page.getByLabel(
    "Signed User Assertion (JWT) (X-User-Identity)"
  );
  await expect(identity).toHaveValue("expired.e2e.assertion");
  expect((await speakingLog(request)).requests[0].userIdentity).toBe(
    "expired.e2e.assertion"
  );
});

test("live Speaking waits for the recording to replace the sample before grading", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    const track = { stop() {} };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [track] }) },
    });
    class DelayedMediaRecorder {
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        window.setTimeout(() => {
          this.ondataavailable?.({
            data: new Blob([new Uint8Array(2048)], { type: this.mimeType }),
          });
          this.onstop?.();
        }, 250);
      }
    }
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: DelayedMediaRecorder,
    });
  });
  await keepBrowserTrafficLocal(page);
  await page.route("**/api/demo/speaking/questions?part=1", (route) =>
    route.fulfill({
      status: 200,
      json: {
        data: {
          questions: [
            {
              id: "p1_do-you-enjoy-living-in-your-city-or-hometown",
              part: 1,
              question: "Do you enjoy living in your city or hometown?",
            },
          ],
        },
      },
    })
  );
  await page.goto("/demo/speaking");
  await waitForHydration(page);
  await page.getByLabel("Mã API (không bắt buộc)").fill(sandboxKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  await expect(
    page.getByRole("heading", { name: "Chọn câu hỏi Speaking" })
  ).toBeVisible();
  await expect(
    page.getByText("Do you enjoy living in your city or hometown?")
  ).toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục đến câu trả lời" }).click();

  const nextStep = page.getByRole("button", { name: "Xem bước chấm" });
  await page.getByRole("button", { name: "Ghi âm", exact: true }).click();
  await expect(page.getByRole("button", { name: "Dừng ghi âm" })).toBeVisible();
  await expect(nextStep).toBeDisabled();
  await page.getByRole("button", { name: "Dừng ghi âm" }).click();
  await expect(nextStep).toBeDisabled();
  await expect(page.getByText("speaking-answer.webm")).toBeVisible();
  await expect(nextStep).toBeEnabled();
  await nextStep.click();
  await page.getByRole("button", { name: "Chấm thật Part 1" }).click();
  await expect(
    page.getByRole("region", { name: "Kết quả chấm Speaking" })
  ).toBeVisible({ timeout: 30_000 });

  const log = await speakingLog(request);
  expect(log.requests.map((item) => item.operation)).toEqual(["grading"]);
  expectIdentityForwarding(log);
});

test("Speaking without a key uses a read-only fixture and grades locally", async ({
  page,
  request,
}) => {
  const expectNoExternalRequests = await keepBrowserTrafficLocal(page);
  await page.route("**/api/demo/speaking/questions?part=*", (route) => {
    const part = Number(
      new URL(route.request().url()).searchParams.get("part")
    );
    const questions = Array.from({ length: 3 }, (_, index) => ({
      id:
        part === 1 && index === 0
          ? "p1_do-you-enjoy-living-in-your-city-or-hometown"
          : `p${part}_sample-${index + 1}`,
      part,
      question:
        part === 1 && index === 0
          ? "Do you enjoy living in your city or hometown?"
          : `Sample Part ${part} question ${index + 1}`,
      sampleAudioUrl: `https://s3.wispace.app/aihub-speaking-samples/speaking-samples/part-${part}/sample-${index + 1}.webm?X-Amz-Expires=900`,
    }));
    return route.fulfill({
      status: 200,
      json: { data: { part, questions } },
    });
  });
  await page.goto("/demo/speaking");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Xem câu hỏi mẫu" }).click();
  await page.getByRole("button", { name: "Quay lại nhập mã API" }).click();
  await expect(
    page.getByRole("heading", { name: "Nhập mã API" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Xem câu hỏi mẫu" }).click();

  await expect(
    page.getByRole("heading", { name: "Chọn câu hỏi Speaking" })
  ).toBeVisible();
  await expect(
    page.getByText(/Chọn Part và câu hỏi mẫu để xem thử/)
  ).toBeVisible();
  const mockIdentity = page.getByLabel("Demo User ID (X-User-Identity)");
  await expect(mockIdentity).toHaveValue(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
  await expect(mockIdentity).toBeDisabled();
  const mockQuestions = page.locator(".demo-scenario-list button");
  await expect(mockQuestions).toHaveCount(3);
  await expect(mockQuestions.nth(2)).toContainText("Sample Part 1 question 3");
  await mockQuestions.nth(2).click();
  await expect(mockQuestions.nth(2)).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Part 2" }).click();
  await expect(mockQuestions).toHaveCount(3);
  await expect(mockQuestions.first()).toContainText("Sample Part 2 question 1");
  await mockQuestions.first().click();
  await page.getByRole("button", { name: "Tiếp tục đến câu trả lời" }).click();
  const sampleAudio = page.locator(
    'audio[aria-label="Nghe bản ghi âm mẫu Speaking"]'
  );
  await expect(sampleAudio).toHaveAttribute(
    "src",
    /part-2\/sample-1\.webm\?X-Amz-Expires=900/
  );
  await page.getByRole("button", { name: "Quay lại câu hỏi" }).click();
  await page.getByRole("button", { name: "Part 3" }).click();
  await expect(mockQuestions).toHaveCount(3);
  await expect(mockQuestions.first()).toContainText("Sample Part 3 question 1");
  await mockQuestions.first().click();
  await page.getByRole("button", { name: "Tiếp tục đến câu trả lời" }).click();
  await expect(sampleAudio).toHaveAttribute(
    "src",
    /part-3\/sample-1\.webm\?X-Amz-Expires=900/
  );
  await page.getByRole("button", { name: "Quay lại câu hỏi" }).click();
  await page.getByRole("button", { name: "Part 1" }).click();
  await expect(mockQuestions).toHaveCount(3);
  await expect(mockQuestions.nth(2)).toContainText("Sample Part 1 question 3");
  await expect(
    page.locator(".demo-scenario-list button[aria-pressed='true']")
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Tiếp tục đến câu trả lời" })
  ).toBeDisabled();
  await mockQuestions.first().click();
  await page.getByRole("button", { name: "Tiếp tục đến câu trả lời" }).click();
  await expect(
    page.getByText(
      /Bạn có thể nghe câu trả lời mẫu nhưng không thể xóa hoặc thay đổi/
    )
  ).toBeVisible();
  await expect(sampleAudio).toHaveAttribute(
    "src",
    "https://s3.wispace.app/ielts-task1/speaking-answers/part-1/do-you-enjoy-living-in-your-city-or-hometown.webm"
  );
  await expect(
    page.getByRole("button", { name: "Chọn tệp ghi âm" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ghi âm", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Xóa tệp ghi âm" })
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Xem bước chấm" }).click();
  await page.getByRole("button", { name: "Xem kết quả mẫu Part 1" }).click();

  await expect(
    page.getByRole("region", { name: "Kết quả chấm Speaking" })
  ).toBeVisible();
  await page.getByRole("tab", { name: "Kết quả nhận được" }).click();
  await expect(page.locator(".demo-console .demo-console-code")).toContainText(
    '"estimated_band"'
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
  await page.getByLabel("Mã API (không bắt buộc)").fill(sandboxKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  await expect(
    page.getByRole("heading", { name: "Chọn câu hỏi Speaking" })
  ).toBeVisible();
  const questionError = page.locator('.demo-error[role="alert"]');
  await expect(questionError).toContainText("Hiện chưa có câu hỏi cho Part 1.");
  await expect(page.locator(".demo-scenario-list button")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Tiếp tục đến câu trả lời" })
  ).toBeDisabled();

  await page.getByRole("button", { name: "Part 2" }).click();
  await expect(questionError).toContainText(
    "Không tải được câu hỏi Speaking. Hãy thử lại."
  );
  const stepper = page.getByRole("navigation", { name: "Các bước thực hành" });
  await expect(stepper.getByRole("button")).toHaveCount(0);
  await expect(stepper.locator('[aria-current="step"]')).toContainText(
    "Mã người dùng và câu hỏi"
  );
  await expect(
    page.getByRole("button", { name: "Tiếp tục đến câu trả lời" })
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
        "X-Demo-Environment": "sandbox",
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
