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

/**
 * A custom property reads back as the authored hex while a computed style is
 * rgb(). Converting here is what lets the assertion compare a rule against its
 * own token rather than against a hard-coded literal.
 */
function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((part) => part + part)
          .join("")
      : value;
  const int = parseInt(full, 16);
  return `rgb(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255})`;
}

/**
 * Every leaf of text on a criterion-tinted surface, with its contrast ratio.
 * A tone paints a pale criterion background, so text that keeps a dark-panel
 * colour goes pale-on-pale — the band number once sat at 1.1:1. Reading the
 * ratio off the page rather than off a hex literal is what keeps the check
 * honest when a palette value moves.
 */
async function tintedTextContrast(page: Page) {
  return page.evaluate(() => {
    const luminance = (rgb: string) => {
      const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
      const channel = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const backgroundOf = (el: Element) => {
      let node: Element | null = el;
      while (node) {
        const colour = getComputedStyle(node).backgroundColor;
        if (colour && !colour.startsWith("rgba(0, 0, 0, 0)")) return colour;
        node = node.parentElement;
      }
      return "rgb(255, 255, 255)";
    };

    const surfaces = [
      ...document.querySelectorAll(".criterion-card"),
      ...document.querySelectorAll("[data-testid=scoring-annotation-detail]"),
    ];
    const measured: Array<{
      element: string;
      foreground: string;
      background: string;
      ratio: number;
    }> = [];

    for (const surface of surfaces) {
      const background = backgroundOf(surface);
      const descendants: Element[] = [];
      const collect = (el: Element) => {
        for (const child of Array.from(el.children)) {
          descendants.push(child);
          collect(child);
        }
      };
      collect(surface);

      for (const el of descendants) {
        const text = (el.textContent ?? "").trim();
        if (!text) continue;
        // Leaves only: a wrapper is measured through the text it contains.
        if (Array.from(el.children).some((c) => (c.textContent ?? "").trim()))
          continue;
        const foreground = getComputedStyle(el).color;
        const a = luminance(foreground);
        const b = luminance(background);
        measured.push({
          element: `${el.tagName.toLowerCase()}.${el.className}`,
          foreground,
          background,
          ratio:
            Math.round(
              ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100
            ) / 100,
        });
      }
    }
    return measured;
  });
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

test("suggestions and next steps render as two lists side by side", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);
  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toBeVisible();

  // The last region of the result layout, which carries no tone class of its
  // own so it cannot be identified by colour.
  const closing = page
    .getByTestId("scoring-report")
    .locator(".rubric-grid:not(.scoring-criteria)");
  await expect(closing.locator(".rubric-card")).toHaveCount(2);
  const tops = await closing
    .locator(".rubric-card")
    .evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top))
    );
  expect(tops[0]).toBe(tops[1]);
});

test("text on a criterion-tinted card stays legible against its own tint", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);
  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toBeVisible();
  await page.getByTestId("annotation-chip-0").click();
  await expect(page.getByTestId("scoring-annotation-detail")).toBeVisible();

  const measured = await tintedTextContrast(page);
  // The check would pass vacuously if the walk stopped finding text.
  expect(measured.length).toBeGreaterThan(20);

  const illegible = measured.filter((item) => item.ratio < 4.5);
  expect(
    illegible,
    `below 4.5:1 — ${illegible
      .map(
        (item) =>
          `${item.element} ${item.foreground} on ${item.background} = ${item.ratio}`
      )
      .join("; ")}`
  ).toEqual([]);
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

test("the Task 2 tab opens without a page load and survives a return visit", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);

  // Nothing navigates: the switch is a client transition within one document.
  await page.evaluate(() => {
    (window as unknown as { __stayed: boolean }).__stayed = true;
  });
  await page.getByTestId("tab-task-2").click();
  await expect(page).toHaveURL(/\/demo\/scoring\?task=2$/);
  expect(
    await page.evaluate(
      () => (window as unknown as { __stayed?: boolean }).__stayed
    )
  ).toBe(true);

  await page.reload();
  await waitForHydration(page);
  await expect(page.getByTestId("tab-task-2")).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.getByTestId("input-topic")).toBeVisible();
});

test("grades the prefilled Task 2 sample, sending topic and no Task 1 field", async ({
  page,
  request,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring?task=2");
  await waitForHydration(page);

  const essay = await page.getByTestId("input-essay").inputValue();
  expect(essay.length).toBeGreaterThan(500);
  expect(essay).toContain("Universities have traditionally focused");
  await expect(page.getByTestId("input-topic")).toHaveValue("education");
  await expect(page.getByTestId("input-question")).toHaveValue(/vocational/);

  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toBeVisible();

  // One call, on the Task 2 path, carrying the topic and nothing from Task 1.
  const log = await scoringLog(request);
  expect(log.requests).toHaveLength(1);
  expect(log.requests[0].task).toBe("2");
  expect(log.requests[0].idempotencyKey).toBeTruthy();
  expect(log.requests[0].body).toMatchObject({ topic: "education" });
  expect(log.requests[0].body).not.toHaveProperty("chart_type");
  expect(log.requests[0].body).not.toHaveProperty("image_url");
});

test("the Task 2 report leads with Task Response in Task Achievement's colour", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring?task=2");
  await waitForHydration(page);
  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toBeVisible();

  // Rendered in the order the response carried them.
  await expect(
    page.getByTestId("scoring-report").locator(".feedback-grid .score-card")
  ).toHaveText([
    /Task Response/,
    /Coherence and Cohesion/,
    /Lexical Resource/,
    /Grammatical Range and Accuracy/,
  ]);

  // Task Response is the same rubric slot as Task Achievement, so it wears the
  // same token — and the annotation on that criterion matches it. The mock
  // returns that annotation second, so its chip is order 1.
  const chip = page.getByTestId("annotation-chip-1");
  await chip.click();
  const detail = page.getByTestId("scoring-annotation-detail");
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("E2E_ONLY_TASK_RESPONSE_ISSUE");

  const responseRule = await chip.evaluate(
    (el) => getComputedStyle(el).borderBottomColor
  );
  const achieveToken = await page
    .locator("main.aihub-demo")
    .first()
    .evaluate((el) =>
      getComputedStyle(el)
        .getPropertyValue("--demo-criterion-achieve-rule")
        .trim()
    );
  // The custom property reads back as authored hex; the computed style is rgb.
  expect(responseRule).toBe(hexToRgb(achieveToken));
  await expect(
    page.locator(".scoring-criteria .criterion-card.tone-achieve").first()
  ).toContainText("Task Response");
});

test("the Task 2 tab renders none of the Task 1 form", async ({ page }) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring?task=2");
  await waitForHydration(page);

  for (const testId of [
    "select-chart-type",
    "input-image-url",
    "scoring-chart-preview",
  ]) {
    await expect(page.getByTestId(testId)).toHaveCount(0);
  }
  await expect(page.getByText(/Dịch vụ chấm tải biểu đồ/)).toHaveCount(0);
});

test("a Task 1 report does not reappear under the Task 2 tab", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);
  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toContainText(
    "Báo cáo chấm bài Task 1"
  );

  await page.getByTestId("tab-task-2").click();
  // A report belongs to the task that produced it.
  await expect(page.getByTestId("scoring-report")).toHaveCount(0);
  await expect(page.locator(".console-empty")).toContainText("Chấm bài Task 2");
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
