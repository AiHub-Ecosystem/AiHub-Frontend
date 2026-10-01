import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { waitForHydration } from "./hydration";
import { mockUrl } from "./ports";

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
  expect(log.requests).toHaveLength(log.assertions.length);
  for (const [index, grading] of log.requests.entries()) {
    expect(grading.userIdentity).toBeTruthy();
    expect(grading.userIdentity).toBe(log.assertions[index]);
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

async function chooseFirstQuestion(page: Page) {
  await page.getByTestId("select-question").click();
  await page.getByRole("option").first().click();
  await page.getByTestId("button-confirm-step-1").click();
}

test.beforeEach(async ({ request }) => {
  await resetSpeakingLog(request);
});

test("Speaking grading sends the User Identity in X-User-Identity", async ({
  page,
  request,
}) => {
  const expectNoExternalRequests = await keepBrowserTrafficLocal(page);
  await page.goto("/demo/speaking");
  await waitForHydration(page);
  await chooseFirstQuestion(page);

  // A prompt with a presigned sample audio URL sends the demo down the
  // JSON-by-URL route without a local file.
  await page.getByTestId("button-confirm-step-2").click();
  await expect(page.getByTestId("panel-feedback-dashboard")).toBeVisible({
    timeout: 30_000, // the first grading call compiles its route on a cold CI dev server
  });

  const log = await speakingLog(request);
  expect(log.requests).toHaveLength(1);
  expect(log.assertions).toHaveLength(1);
  const [grading] = log.requests;
  expect(grading.operation).toBe("grading-json");
  expectIdentityForwarding(log);
  expectNoExternalRequests();
});

test("Speaking grading by uploaded audio sends the User Identity in X-User-Identity", async ({
  page,
  request,
}) => {
  const expectNoExternalRequests = await keepBrowserTrafficLocal(page);
  await page.goto("/demo/speaking");
  await waitForHydration(page);
  await chooseFirstQuestion(page);

  // Uploading a file routes the demo to the multipart grading operation.
  await page.getByTestId("input-audio-file").setInputFiles({
    name: "e2e-answer.wav",
    mimeType: "audio/wav",
    buffer: Buffer.alloc(2048, 1),
  });
  await page.getByTestId("button-confirm-step-2").click();
  await expect(page.getByTestId("panel-feedback-dashboard")).toBeVisible({
    timeout: 30_000, // the first grading call compiles its route on a cold CI dev server
  });

  const log = await speakingLog(request);
  expect(log.requests).toHaveLength(1);
  expect(log.assertions).toHaveLength(1);
  const [grading] = log.requests;
  expect(grading.operation).toBe("grading");
  expectIdentityForwarding(log);
  expectNoExternalRequests();
});

test("Speaking grading mints a fresh assertion for each request", async ({
  page,
  request,
}) => {
  const expectNoExternalRequests = await keepBrowserTrafficLocal(page);
  await page.goto("/demo/speaking");
  await waitForHydration(page);
  await chooseFirstQuestion(page);
  await page.getByTestId("button-confirm-step-2").click();
  await expect(page.getByTestId("panel-feedback-dashboard")).toBeVisible({
    timeout: 30_000, // the first grading call compiles its route on a cold CI dev server
  });

  await page.getByRole("button", { name: /Reset toàn bộ/ }).click();
  await chooseFirstQuestion(page);
  await page.getByTestId("button-confirm-step-2").click();
  await expect(page.getByTestId("panel-feedback-dashboard")).toBeVisible({
    timeout: 30_000, // the first grading call compiles its route on a cold CI dev server
  });

  const log = await speakingLog(request);
  expect(log.requests).toHaveLength(2);
  expect(log.assertions).toHaveLength(2);
  const identities = log.requests.map((entry) => entry.userIdentity);
  expectIdentityForwarding(log);
  expect(identities[0]).not.toBe(identities[1]);
  expectNoExternalRequests();
});
