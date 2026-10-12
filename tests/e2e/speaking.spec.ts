import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { waitForHydration } from "./hydration";

const mockUrl = "http://127.0.0.1:3101";
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

async function chooseFirstQuestion(page: Page) {
  await page.getByTestId("select-question").click();
  await page.getByRole("option").first().click();
  await page.getByTestId("button-confirm-step-1").click();
}

test.beforeEach(async ({ request }) => {
  await resetSpeakingLog(request);
});

test("Speaking grading forwards the demo UUID in X-User-Identity", async ({
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
  const [grading] = log.requests;
  expect(grading.operation).toBe("grading-json");
  expectIdentityForwarding(log);
  expectNoExternalRequests();
});

test("Speaking grading by uploaded audio forwards the demo UUID", async ({
  page,
  request,
}) => {
  // The multipart route is the last one this suite reaches, so its compile
  // lands on a cold dev server. The assertion below wants 30s, which the
  // default test deadline would cut off a moment before.
  test.setTimeout(90_000);
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
  const [grading] = log.requests;
  expect(grading.operation).toBe("grading");
  expectIdentityForwarding(log);
  expectNoExternalRequests();
});

test("Speaking grading reuses the demo UUID for the session", async ({
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
  const identities = log.requests.map((entry) => entry.userIdentity);
  expectIdentityForwarding(log);
  expect(identities[0]).toBe(identities[1]);
  expectNoExternalRequests();
});
