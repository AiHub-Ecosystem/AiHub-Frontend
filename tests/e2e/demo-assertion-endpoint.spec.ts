import { expect, test, type Page } from "@playwright/test";
import { waitForHydration } from "./hydration";

const mockUrl = "http://127.0.0.1:3101";
const signedSandboxKey = "aihub_sk_e2e_signed_sandbox_key";
const endpointUrl = "https://customer.example.test/demo/assertion";
const fixedNow = new Date("2026-10-16T12:00:00.000Z");
const fixedNowSeconds = Math.floor(fixedNow.getTime() / 1000);

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function validAssertion(exp = fixedNowSeconds + 300) {
  return {
    token: `${base64Url(JSON.stringify({ alg: "RS256", kid: "demo" }))}.${base64Url(JSON.stringify({ exp, sub: "demo-user" }))}.${base64Url("signature")}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

async function mockCustomerEndpoint(
  page: Page,
  result: { errorCode?: string } = {},
  options: { controlClock?: boolean; defer?: boolean } = {}
) {
  if (options.controlClock) await page.clock.install({ time: fixedNow });
  else await page.clock.setFixedTime(fixedNow);
  let errorCode = result.errorCode;
  let releaseResponse: (() => void) | null = null;
  let markResponseDeferred: () => void = () => undefined;
  const responseDeferred = new Promise<void>((resolve) => {
    markResponseDeferred = resolve;
  });
  const calls: Array<{
    method: string;
    postData: string | null;
    headers: Record<string, string>;
  }> = [];
  const assertion = validAssertion();
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "customer.example.test") {
      calls.push({
        method: route.request().method(),
        postData: route.request().postData(),
        headers: route.request().headers(),
      });
      if (options.defer)
        await new Promise<void>((resolve) => {
          releaseResponse = resolve;
          markResponseDeferred();
        });
      const customerResponse = {
        status:
          errorCode === "RATE_LIMITED"
            ? 429
            : errorCode === "ISSUER_ERROR"
              ? 502
              : errorCode
                ? 503
                : 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "http://127.0.0.1:3100",
          "cache-control": "no-store",
        },
        body: JSON.stringify(
          errorCode
            ? { error: { code: errorCode, message: "raw customer secret" } }
            : { assertion: assertion.token, expires_at: assertion.expiresAt }
        ),
      };
      if (options.defer)
        await route.fulfill(customerResponse).catch(() => undefined);
      else await route.fulfill(customerResponse);
      return;
    }
    if (url.hostname === "127.0.0.1") {
      await route.continue();
      return;
    }
    if (url.hostname === "s3.wispace.app") {
      await route.fulfill({
        status: 200,
        contentType: url.pathname.endsWith(".png") ? "image/png" : "audio/mpeg",
        body: Buffer.alloc(2048, 1),
      });
      return;
    }
    await route.abort();
  });
  return {
    calls,
    responseDeferred,
    ...assertion,
    failWith: (code: string) => (errorCode = code),
    release: () => releaseResponse?.(),
  };
}

async function validateSignedKey(page: Page, route: "scoring" | "speaking") {
  await waitForHydration(page);
  await page.getByLabel("Mã API (không bắt buộc)").fill(signedSandboxKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  await expect(
    page.getByLabel("URL endpoint cấp assertion (HTTPS)")
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", {
      name: route === "scoring" ? "Chọn bài Writing" : "Chọn câu hỏi Speaking",
    })
  ).toBeVisible();
}

async function fetchAssertion(page: Page, token: string) {
  await page.getByLabel("URL endpoint cấp assertion (HTTPS)").fill(endpointUrl);
  await page.getByRole("button", { name: "Lấy assertion" }).click();
  await expect(page.getByRole("status")).toContainText("Assertion đã sẵn sàng");
  await page.getByText("Nhập assertion thủ công").click();
  const identity = page.getByLabel(
    "Signed User Assertion (JWT) (X-User-Identity)"
  );
  await expect(identity).toHaveValue(token);
  await expect(identity).toHaveAttribute("type", "password");
}

test("Writing fetches an assertion on demand and forwards it redacted to live grading", async ({
  page,
  request,
  context,
}) => {
  const customer = await mockCustomerEndpoint(page);
  await context.addCookies([
    {
      name: "customer_session",
      value: "must-not-be-sent",
      url: "https://customer.example.test",
      sameSite: "None",
      secure: true,
    },
  ]);
  await request.post(`${mockUrl}/__test__/scoring/reset`);
  await page.goto("/demo/scoring");
  await validateSignedKey(page, "scoring");
  await expect(
    page.getByLabel("URL endpoint cấp assertion (HTTPS)")
  ).toHaveAttribute("autocomplete", "off");
  expect(customer.calls).toHaveLength(0);
  await fetchAssertion(page, customer.token);

  expect(customer.calls).toHaveLength(1);
  expect(customer.calls[0]).toMatchObject({ method: "POST", postData: null });
  expect(customer.calls[0]?.headers.origin).toBe("http://127.0.0.1:3100");
  expect(customer.calls[0]?.headers.cookie).toBeUndefined();
  expect(customer.calls[0]?.headers.authorization).toBeUndefined();
  expect(customer.calls[0]?.headers["x-api-key"]).toBeUndefined();
  expect(customer.calls[0]?.headers["x-user-identity"]).toBeUndefined();
  expect(customer.calls[0]?.headers["content-type"]).toBeUndefined();
  expect(page.url()).not.toContain(customer.token);
  const browserStorage = await page.evaluate(() =>
    [localStorage, sessionStorage]
      .map((storage) =>
        Array.from({ length: storage.length }, (_, index) =>
          storage.getItem(storage.key(index) ?? "")
        ).join("\n")
      )
      .join("\n")
  );
  expect(browserStorage).not.toContain(customer.token);
  const beforeGrade = await (
    await request.get(`${mockUrl}/__test__/scoring/requests`)
  ).json();
  expect(beforeGrade.requests).toHaveLength(0);

  await page.getByRole("button", { name: "Tiếp tục đến bài làm" }).click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();
  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toBeVisible();
  const log = await (
    await request.get(`${mockUrl}/__test__/scoring/requests`)
  ).json();
  expect(log.requests[0].userIdentity).toBe(customer.token);
  const trace = page.locator(".demo-console .demo-console-code");
  await expect(trace).toContainText("<redacted signed user assertion>");
  await expect(trace).not.toContainText(customer.token);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .locator(".demo-console")
    .getByRole("button", { name: "Sao chép" })
    .click();
  expect(
    await page.evaluate(() => navigator.clipboard.readText())
  ).not.toContain(customer.token);
  await page.getByTestId("button-copy-export").click();
  expect(
    await page.evaluate(() => navigator.clipboard.readText())
  ).not.toContain(customer.token);
});

test("Speaking fetches an assertion and uses the shared identity flow", async ({
  page,
  request,
}) => {
  const customer = await mockCustomerEndpoint(page);
  await request.post(`${mockUrl}/__test__/speaking/reset`);
  await page.goto("/demo/speaking");
  await validateSignedKey(page, "speaking");
  await page
    .locator(".demo-scenario-list")
    .getByText("E2E_ONLY_QUESTION_1")
    .click();
  await fetchAssertion(page, customer.token);
  expect(customer.calls).toHaveLength(1);
  expect(customer.calls[0]?.method).toBe("POST");
  expect(customer.calls[0]?.postData).toBeNull();
  expect(customer.calls[0]?.headers.authorization).toBeUndefined();
  expect(customer.calls[0]?.headers["x-api-key"]).toBeUndefined();
  const beforeGrade = await (
    await request.get(`${mockUrl}/__test__/speaking/requests`)
  ).json();
  expect(beforeGrade.requests).toHaveLength(0);

  await page.getByRole("button", { name: "Tiếp tục đến câu trả lời" }).click();
  await page.getByTestId("input-audio-file").setInputFiles({
    name: "e2e-answer.wav",
    mimeType: "audio/wav",
    buffer: Buffer.alloc(2048, 1),
  });
  await page.getByRole("button", { name: "Xem bước chấm" }).click();
  await page.getByRole("button", { name: "Chấm thật Part 1" }).click();
  await expect(
    page.getByRole("region", { name: "Kết quả chấm Speaking" })
  ).toBeVisible({
    timeout: 30_000,
  });
  const log = await (
    await request.get(`${mockUrl}/__test__/speaking/requests`)
  ).json();
  expect(log.requests[0].userIdentity).toBe(customer.token);
  const trace = page.locator(".demo-console .demo-console-code");
  await expect(trace).toContainText("<redacted signed user assertion>");
  await expect(trace).not.toContainText(customer.token);
});

test("endpoint failures show safe guidance and clear an old assertion", async ({
  page,
  request,
}) => {
  const customer = await mockCustomerEndpoint(page);
  await request.post(`${mockUrl}/__test__/scoring/reset`);
  await page.goto("/demo/scoring");
  await validateSignedKey(page, "scoring");
  await fetchAssertion(page, customer.token);
  customer.failWith("ISSUER_ERROR");
  await page.getByRole("button", { name: "Lấy assertion" }).click();

  const alert = page.locator(".demo-error[role=alert]");
  await expect(alert).toContainText("Máy chủ cấp assertion gặp lỗi");
  await expect(alert).not.toContainText("raw customer secret");
  expect(customer.calls).toHaveLength(2);
  expect(customer.calls[1]?.postData).toBeNull();
  await page.getByText("Nhập assertion thủ công").click();
  await expect(
    page.getByLabel("Signed User Assertion (JWT) (X-User-Identity)")
  ).toHaveValue("");
  await page.getByRole("button", { name: "Tiếp tục đến bài làm" }).click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();
  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toHaveCount(0);
  const grading = await (
    await request.get(`${mockUrl}/__test__/scoring/requests`)
  ).json();
  expect(grading.requests).toHaveLength(0);
});

test("manual assertion edits cancel an in-flight endpoint response", async ({
  page,
}) => {
  const customer = await mockCustomerEndpoint(page, {}, { defer: true });
  await page.goto("/demo/scoring");
  await validateSignedKey(page, "scoring");
  await page.getByLabel("URL endpoint cấp assertion (HTTPS)").fill(endpointUrl);

  const fetchClick = page
    .getByRole("button", { name: "Lấy assertion" })
    .click();
  await expect.poll(() => customer.calls.length).toBe(1);
  await customer.responseDeferred;
  await page.getByText("Nhập assertion thủ công").click();
  const manualAssertion = validAssertion(fixedNowSeconds + 240).token;
  const identity = page.getByLabel(
    "Signed User Assertion (JWT) (X-User-Identity)"
  );
  await identity.fill(manualAssertion);
  customer.release();
  await fetchClick;

  await expect(identity).toHaveValue(manualAssertion);
  await expect(page.getByText("Assertion đã sẵn sàng")).toHaveCount(0);
});

test("a stalled endpoint request times out and can be retried", async ({
  page,
}) => {
  const customer = await mockCustomerEndpoint(
    page,
    {},
    { controlClock: true, defer: true }
  );
  await page.goto("/demo/scoring");
  await validateSignedKey(page, "scoring");
  await page.getByLabel("URL endpoint cấp assertion (HTTPS)").fill(endpointUrl);

  const fetchClick = page
    .getByRole("button", { name: "Lấy assertion" })
    .click();
  await expect.poll(() => customer.calls.length).toBe(1);
  await customer.responseDeferred;
  await page.clock.fastForward(15_000);
  customer.release();
  await fetchClick;

  await expect(page.locator('.demo-error[role="alert"]')).toContainText(
    "Endpoint không phản hồi trong 15 giây"
  );
  await expect(
    page.getByRole("button", { name: "Lấy assertion" })
  ).toBeEnabled();
});

for (const route of ["scoring", "speaking"] as const) {
  test(`${route} blocks live grading after a fetched assertion expires`, async ({
    page,
    request,
  }) => {
    const customer = await mockCustomerEndpoint(
      page,
      {},
      { controlClock: true }
    );
    const resetPath = route === "scoring" ? "scoring/reset" : "speaking/reset";
    await request.post(`${mockUrl}/__test__/${resetPath}`);
    await page.goto(route === "scoring" ? "/demo/scoring" : "/demo/speaking");
    await validateSignedKey(page, route);
    if (route === "speaking")
      await page
        .locator(".demo-scenario-list")
        .getByText("E2E_ONLY_QUESTION_1")
        .click();
    await fetchAssertion(page, customer.token);

    await page.clock.fastForward(301_000);
    await expect(
      page.locator('.demo-error[role="alert"]').filter({
        hasText: "Assertion đã hết hạn",
      })
    ).toBeVisible();

    if (route === "scoring") {
      await page.getByRole("button", { name: "Tiếp tục đến bài làm" }).click();
      await page.getByRole("button", { name: "Xem bước chấm" }).click();
      await page.getByTestId("button-grade").click();
      await expect(page.getByTestId("scoring-report")).toHaveCount(0);
      const log = await (
        await request.get(`${mockUrl}/__test__/scoring/requests`)
      ).json();
      expect(log.requests).toHaveLength(0);
    } else {
      await page
        .getByRole("button", { name: "Tiếp tục đến câu trả lời" })
        .click();
      await page.getByTestId("input-audio-file").setInputFiles({
        name: "e2e-answer.wav",
        mimeType: "audio/wav",
        buffer: Buffer.alloc(2048, 1),
      });
      await page.getByRole("button", { name: "Xem bước chấm" }).click();
      await page.getByRole("button", { name: "Chấm thật Part 1" }).click();
      const log = await (
        await request.get(`${mockUrl}/__test__/speaking/requests`)
      ).json();
      expect(log.requests).toHaveLength(0);
    }
  });
}

test("endpoint and assertion are shared between demos and cleared when the visit ends", async ({
  page,
}) => {
  const customer = await mockCustomerEndpoint(page);
  await page.goto("/demo/scoring");
  await validateSignedKey(page, "scoring");
  await fetchAssertion(page, customer.token);

  await page.getByRole("link", { name: "Speaking", exact: true }).click();
  await waitForHydration(page);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  await expect(
    page.getByLabel("URL endpoint cấp assertion (HTTPS)")
  ).toHaveValue(endpointUrl);
  await page.getByText("Nhập assertion thủ công").click();
  await expect(
    page.getByLabel("Signed User Assertion (JWT) (X-User-Identity)")
  ).toHaveValue(customer.token);

  await page.goto("/");
  await page.goto("/demo/scoring");
  await waitForHydration(page);
  await page.getByLabel("Mã API (không bắt buộc)").fill(signedSandboxKey);
  await page.getByRole("button", { name: "Kiểm tra mã API" }).click();
  await expect(
    page.getByLabel("URL endpoint cấp assertion (HTTPS)")
  ).toHaveValue("");
  expect(customer.calls).toHaveLength(1);
});
