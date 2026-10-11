import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { waitForHydration } from "./hydration";

const mockUrl = "http://127.0.0.1:3101";

type ScoringRequest = {
  task: string;
  idempotencyKey: string | null;
  userIdentity: string | null;
  body: Record<string, unknown>;
};

async function resetScoringLog(request: APIRequestContext) {
  expect((await request.post(`${mockUrl}/__test__/scoring/reset`)).ok()).toBe(
    true
  );
}

async function scoringLog(request: APIRequestContext) {
  const response = await request.get(`${mockUrl}/__test__/scoring/requests`);
  return (await response.json()) as { requests: ScoringRequest[] };
}

/**
 * The unit parser covers field validation. What only a browser can see is the
 * wiring: that the page reaches the gate without a login, that no credential
 * is in the page, and that the report renders in the order and colour the
 * response carried.
 */
async function keepBrowserTrafficLocal(page: Page) {
  const external: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") {
      await route.continue();
      return;
    }
    // The chart preview points at the sample image; it never needs to load.
    if (url.hostname === "s3.wispace.app") {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fccfc0500f0004850181",
          "hex"
        ),
      });
      return;
    }
    external.push(url.hostname);
    await route.abort();
  });
  return () => expect(external).toEqual([]);
}

test.beforeEach(async ({ request }) => {
  await resetScoringLog(request);
});

test("the catalog offers the scoring demo as Stable with a link", async ({
  page,
}) => {
  await page.goto("/demo");

  const card = page
    .locator(".aihub-demo-product", { hasText: "Chấm điểm" })
    .first();
  await expect(card.locator(".aihub-badge")).toHaveText("Stable");
  await card.locator("a", { hasText: "Mở demo" }).click();

  await expect(page).toHaveURL(/\/demo\/scoring$/);
  await expect(page.locator("main.aihub-demo")).toBeVisible();
});

test("grades the prefilled Task 1 sample without a login", async ({
  page,
  request,
}) => {
  const assertNoExternalTraffic = await keepBrowserTrafficLocal(page);
  const failed: string[] = [];
  page.on("pageerror", (error) => failed.push(error.message));

  await page.goto("/demo/scoring");
  await waitForHydration(page);

  // The page must be runnable with no typing.
  const essay = await page.getByTestId("input-essay").inputValue();
  expect(essay.length).toBeGreaterThan(500);
  expect(essay).toContain("The bar chart illustrates");
  await expect(page.getByTestId("select-chart-type")).toHaveValue("Bar Chart");
  await expect(page.getByTestId("input-image-url")).toHaveValue(/^https:\/\//);

  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toBeVisible();

  // A plain declared user id, and no assertion was ever minted.
  const log = await scoringLog(request);
  expect(log.requests).toHaveLength(1);
  expect(log.requests[0].task).toBe("1");
  expect(log.requests[0].userIdentity).toMatch(/^[\x21-\x7e]{1,256}$/);
  expect(log.requests[0].idempotencyKey).toBeTruthy();
  expect(log.requests[0].body).toMatchObject({
    chart_type: "Bar Chart",
    image_url: /^https:\/\//,
  });

  // The API key and upstream host are server-side only.
  const html = await page.content();
  expect(html).not.toContain("aihub_sk_");
  expect(html).not.toContain("sandbox.aihubproduction.com");

  expect(failed, `page errors: ${failed.join(" | ")}`).toEqual([]);
  assertNoExternalTraffic();
});

test("the report keeps the criteria order the response carried", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);
  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toBeVisible();

  await expect(
    page.getByTestId("scoring-report").locator(".feedback-grid .score-card")
  ).toHaveText([
    /Task Achievement/,
    /Coherence and Cohesion/,
    /Lexical Resource/,
    /Grammatical Range and Accuracy/,
  ]);
});

test("an annotation highlight is keyboard reachable and reveals its detail", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);
  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toBeVisible();

  const chip = page.getByTestId("annotation-chip-0");
  await chip.focus();
  await page.keyboard.press("Enter");

  const detail = page.getByTestId("scoring-annotation-detail");
  await expect(detail).toBeVisible();
  // `issue` is a free string from upstream, rendered as itself.
  await expect(detail).toContainText("imprecise_word_choice");
  await expect(detail).toContainText("E2E_ONLY_EXPLANATION");
});

test("the same colour ties a criterion's card, badge and annotation together", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);
  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toBeVisible();

  const lexicalCard = page
    .locator(".scoring-criteria .criterion-card.tone-lexical")
    .first();
  const chip = page.getByTestId("annotation-chip-0");
  await chip.click();

  const cardBg = await lexicalCard.evaluate(
    (el) => getComputedStyle(el).borderLeftColor
  );
  const chipRule = await chip.evaluate(
    (el) => getComputedStyle(el).borderBottomColor
  );

  expect(chipRule).toBe(cardBg);
  // The card rule, the chip underline and the detail all come from
  // --demo-criterion-lexical-*.
  expect(cardBg).toBe("rgb(15, 122, 115)");
});

test("the page ships on the new brand while speaking stays on the old one", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);

  const tokens = await page
    .locator("main.aihub-demo")
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return [
        s.getPropertyValue("--demo-brand").trim(),
        s.getPropertyValue("--demo-ink").trim(),
      ];
    });
  expect(tokens).toEqual(["#5b5fef", "#14152b"]);

  // Speaking is untouched and still reads the site palette.
  await page.goto("/demo/speaking");
  const speakingBrand = await page
    .locator("main.aihub-demo")
    .first()
    .evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--demo-brand").trim()
    );
  expect(speakingBrand).not.toBe("#5b5fef");
});

test("a rejected submission shows its code and no credential leaked", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);

  await page.getByTestId("input-question").fill("");
  await page.getByTestId("button-grade").click();

  const error = page.getByTestId("scoring-error");
  await expect(error).toBeVisible();
  await expect(error).toContainText("INVALID_REQUEST");
});

test("the four criteria fit a phone without horizontal scrolling", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/scoring");
  await waitForHydration(page);
  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toBeVisible();

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const cards = page
    .getByTestId("scoring-report")
    .locator(".feedback-grid .score-card");
  await expect(cards).toHaveCount(4);
  const widths = await cards.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().width))
  );
  expect(Math.min(...widths)).toBeGreaterThan(150);
});
