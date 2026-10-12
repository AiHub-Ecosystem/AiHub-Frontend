import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { waitForHydration } from "./hydration";
import { expectReadable } from "./text-contrast";

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

async function setScoringConfig(
  request: APIRequestContext,
  config: { noAnnotations: boolean }
) {
  const response = await request.post(`${mockUrl}/__test__/scoring/config`, {
    data: config,
  });
  expect(response.ok()).toBe(true);
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
      // A path under /missing stands for the failure this page has to survive:
      // a URL that is well formed and points at nothing. It has to be answered
      // with an error document rather than a 404 carrying image bytes, because
      // an <img> decodes what it is given and never asks for the status — a
      // 404 full of PNG still fires `load`, and the guard would never arm.
      if (url.pathname.startsWith("/missing")) {
        await route.fulfill({
          status: 404,
          contentType: "text/html",
          body: "<html><body>Not Found</body></html>",
        });
        return;
      }
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

/**
 * Regression guard for a class of defect nothing else caught: the page renders,
 * grades correctly, and is still unreadable. A bare heading inherited a white
 * colour from a global stylesheet built for an unrelated site theme and sat
 * white on a white card.
 */
test("every text on the page is readable, before and after a grade", async ({
  page,
}) => {
  // The Task 1 page renders the sample chart from s3.wispace.app. Without this
  // the navigation waits on a real network fetch, which hangs the test when
  // the suite runs without outbound access.
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);
  await expectReadable(page);

  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toBeVisible();
  await expectReadable(page);
});

/**
 * The site header is `position: fixed` above every panel here. A sticky column
 * offset below its height slides underneath it, so the report heading vanished
 * while scrolling down the page. The sticky offset has to clear the header.
 */
test("a scrolled report clears the fixed site header instead of hiding behind it", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);
  // Measured before grading, while the panel is short enough to stick. Once a
  // report exists it is taller than any viewport, and scrolling it past the
  // header is what a reader wants.

  // A quarter of the way down, not a fixed pixel count: this lands inside the
  // band where the panel is actually pinned, whatever the page's length. A
  // hardcoded offset quietly falls past that band the day the page gets
  // shorter, and the test then measures a panel that is no longer stuck.
  await page.evaluate(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.round(max * 0.25));
  });

  // The header animates from 120px down to 72px as the page scrolls. A fixed
  // sleep, and a threshold like "under 100px", both catch it mid-transition and
  // then compare against a height that is on its way out — which is how this
  // test passed while the panel sat 8px behind the header. Two identical
  // readings in a row is what settling actually looks like.
  const read = () =>
    page.evaluate(() => {
      const header = document.querySelector("header");
      const panel = document.querySelector(".scoring-result");
      if (!header || !panel) throw new Error("the header or panel is missing");
      return {
        position: getComputedStyle(header).position,
        height: Math.round(header.getBoundingClientRect().height),
        headerBottom: Math.round(header.getBoundingClientRect().bottom),
        panelTop: Math.round(panel.getBoundingClientRect().top),
      };
    });

  // First wait for the shrink to begin at all. Two readings taken in a row can
  // agree at the resting height simply because the scroll handler's animation
  // frame has not run yet, which reads as "settled" and measures 120px.
  await expect
    .poll(async () => (await read()).height, { timeout: 5000 })
    .toBeLessThan(100);

  // Then wait for it to stop moving for a continuous stretch. Two readings in a
  // row can match mid-transition — the header passes through 96px on its way
  // from 120 to 72 — so a single repeat is not proof of settling.
  let geometry = await read();
  let stableFor = 0;
  for (let attempt = 0; attempt < 40 && stableFor < 300; attempt++) {
    await page.waitForTimeout(100);
    const next = await read();
    stableFor = next.height === geometry.height ? stableFor + 100 : 0;
    geometry = next;
  }
  // If the header stops being fixed, this test would be measuring nothing.
  expect(geometry.position).toBe("fixed");

  // Both directions. Too small hides the panel behind the header; too large
  // leaves dead space above it, which is the same defect pointed the other way.
  expect(geometry.panelTop).toBeGreaterThanOrEqual(geometry.headerBottom - 1);
  expect(geometry.panelTop).toBeLessThanOrEqual(geometry.headerBottom + 32);
});

/**
 * The visitor is not an integration. The gateway mints the idempotency key,
 * so a UUID appearing anywhere in the form means the key moved back into the
 * UI — which is the regression this guards.
 */
test("the form shows the visitor no key to manage", async ({ page }) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);

  await expect(
    page.getByText(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    )
  ).toHaveCount(0);
});

/**
 * A heading inside the demo must never reach display type. `meltano-source.css`
 * styles bare `h1`/`h2`/`h3` at 48px, and Scoring marks this heading `h2`
 * where Speaking marks it `h1` — so an `h1`-only rule left it falling through
 * to the foreign stylesheet and it towered over the form beside it.
 */
test("no demo heading inherits display type from the foreign stylesheet", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);

  const headings = await page
    .locator(".aihub-demo :is(h1, h2, h3, h4, h5, h6)")
    .evaluateAll((els) =>
      els.map((el) => ({
        text: el.textContent?.trim().slice(0, 40) ?? "",
        size: parseFloat(getComputedStyle(el).fontSize),
      }))
    );

  // Nothing on this page is legitimately display type: the page title is 22px
  // and the report heading 17px. Any heading past 24px has come from the bare
  // rules, which is the whole defect.
  const oversized = headings.filter((h) => h.size > 24);
  expect(oversized, `headings: ${JSON.stringify(headings)}`).toEqual([]);
});

/**
 * A grade with nothing worth quoting is a real outcome, not a broken feature.
 * Rendering it as "0 chỗ được trích" reads like a failed count, so the page has
 * to say the essay went unquoted in words instead.
 */
test("an essay with nothing to quote says so, rather than showing a count of zero", async ({
  page,
  request,
}) => {
  await setScoringConfig(request, { noAnnotations: true });
  try {
    await keepBrowserTrafficLocal(page);
    await page.goto("/demo/scoring");
    await waitForHydration(page);
    await page.getByTestId("button-grade").click();
    await expect(page.getByTestId("scoring-report")).toBeVisible();

    const kicker = page
      .locator('[data-testid="scoring-report"] .section-kicker')
      .first();
    await expect(kicker).toContainText("Không có chỗ nào bị trích ra");
    // The count form is the thing being ruled out.
    await expect(kicker).not.toContainText("0 chỗ được trích");
    // No chips to click when there are no annotations.
    await expect(
      page.locator('[data-testid="scoring-report"] .word-chip')
    ).toHaveCount(0);
  } finally {
    await setScoringConfig(request, { noAnnotations: false });
  }
});

/**
 * Deleting markup on this page has cost its spacing three times: removing the
 * intro heading took the `margin: 8px 0 10px` that separated the eyebrow from
 * the task tabs, and removing the overview left the result column hugging an
 * empty state. Each of those shipped and each was reported by a reader.
 *
 * These are the gaps the page's rhythm depends on. Measuring all three in one
 * pass keeps the list honest: when markup moves, the gap that carried the
 * spacing moves with it and fails here rather than looking like a design
 * decision to whoever opens the page next.
 */
test("the workbench keeps its spacing, neither crowding nor gaping", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);

  const gaps = await page.evaluate(() => {
    const box = (selector: string) =>
      document.querySelector(selector)!.getBoundingClientRect();
    return {
      eyebrowToTabs: Math.round(
        box(".scoring-task-tabs").top - box(".setup-intro .eyebrow").bottom
      ),
      tabsToFirstField: Math.round(
        box(".scoring-form .mini-label").top - box(".scoring-task-tabs").bottom
      ),
      headingToConsole: Math.round(
        box(".console").top - box(".main-heading").bottom
      ),
    };
  });

  const bounds: Record<keyof typeof gaps, [number, number]> = {
    eyebrowToTabs: [6, 14],
    tabsToFirstField: [12, 24],
    headingToConsole: [10, 24],
  };

  for (const [name, [low, high]] of Object.entries(bounds)) {
    const actual = gaps[name as keyof typeof gaps];
    expect(
      actual,
      `${name} was ${actual}px, expected ${low}-${high}px`
    ).toBeGreaterThanOrEqual(low);
    expect(
      actual,
      `${name} was ${actual}px, expected ${low}-${high}px`
    ).toBeLessThanOrEqual(high);
  }
});

/**
 * A chart that cannot be loaded is the one failure this page can still prevent.
 * `isFetchableImageUrl` checks the URL's shape — https, no credentials, within
 * 2 000 characters — and cannot check that the image is there. So a dead one is
 * forwarded, the grading service reads no chart, grades the essay anyway, and
 * returns a confident band. The sandbox allows 25 dispatches per Organization
 * per month and the demo does not retry, so that is 4% of the budget spent to
 * learn nothing.
 *
 * The preview is the only request this page makes to the chart, so its load
 * event is the only signal available that costs no quota.
 */
test("a chart that does not load stops the grade, and can be overridden on purpose", async ({
  page,
  request,
}) => {
  await keepBrowserTrafficLocal(page);
  await resetScoringLog(request);
  await page.goto("/demo/scoring");
  await waitForHydration(page);

  // The published chart loads, so the page says nothing about it.
  await expect(page.getByTestId("chart-load-warning")).toBeHidden();
  await expect(page.getByTestId("button-grade")).toBeEnabled();

  await page
    .getByTestId("input-image-url")
    .fill("https://s3.wispace.app/missing-chart.png");

  await expect(page.getByTestId("chart-load-warning")).toBeVisible();
  await expect(page.getByTestId("button-grade")).toBeDisabled();

  // The browser refusing to embed an image is not proof the grading service
  // cannot fetch it, so overriding is an explicit act rather than a default.
  await page.getByTestId("chart-load-override").check();
  await expect(page.getByTestId("button-grade")).toBeEnabled();

  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toBeVisible();

  // Overriding changes what the page is willing to do, not what it sends.
  // `task` is absent because the endpoint identifies the task, not the body.
  const { requests } = await scoringLog(request);
  expect(requests).toHaveLength(1);
  expect(requests[0].body).toEqual({
    question: expect.any(String),
    essay: expect.any(String),
    chart_type: expect.any(String),
    image_url: "https://s3.wispace.app/missing-chart.png",
  });
});

test("correcting the chart URL clears the warning without an override", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);

  await page
    .getByTestId("input-image-url")
    .fill("https://s3.wispace.app/missing-chart.png");
  await expect(page.getByTestId("chart-load-warning")).toBeVisible();

  await page
    .getByTestId("input-image-url")
    .fill("https://s3.wispace.app/ielts-task1/ca95bd4ab522946d");
  await expect(page.getByTestId("chart-load-warning")).toBeHidden();
  await expect(page.getByTestId("button-grade")).toBeEnabled();
});

test("a broken chart on Task 1 does not follow the visitor to Task 2", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);

  await page
    .getByTestId("input-image-url")
    .fill("https://s3.wispace.app/missing-chart.png");
  await expect(page.getByTestId("chart-load-warning")).toBeVisible();
  await expect(page.getByTestId("button-grade")).toBeDisabled();

  await page.getByTestId("tab-task-2").click();
  await waitForHydration(page);

  // Task 2 has no chart to load and nothing to warn about. Storing the verdict
  // as a plain boolean would leave this button disabled with no warning visible
  // to explain why, which is how a guard turns into a dead page.
  await expect(page.getByTestId("input-image-url")).toBeHidden();
  await expect(page.getByTestId("chart-load-warning")).toBeHidden();
  await expect(page.getByTestId("button-grade")).toBeEnabled();
});

/**
 * The report sets its own floor: below about 590px of console, three elements
 * inside it overflow horizontally. The page does not scroll — the console clips
 * its own content — so the damage reads as a truncated report rather than as a
 * layout fault, and it only appears once a grade has arrived, after the visitor
 * has already waited for the answer.
 *
 * Measured: at 980px the console is 586px and clean; at 960px it is 566px and
 * one element overflows; at 940px it is 546px and three do. The shell stacked
 * its columns at 720px, far below any of that.
 */
test("the report is never clipped, at any width", async ({ page }) => {
  // Each width costs a load and a full grade, which the default timeout does not
  // cover. The failure this guards is invisible without all of them.
  test.setTimeout(90_000);
  await keepBrowserTrafficLocal(page);

  for (const width of [1440, 1024, 960, 900, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/demo/scoring");
    await waitForHydration(page);
    await page.getByTestId("button-grade").click();
    await page.getByTestId("scoring-report").waitFor();

    const clipped = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".scoring-result *"))
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map(
          (element) =>
            `${element.className}`.split(" ")[0] +
            ` ${element.scrollWidth}/${element.clientWidth}` +
            ` "${element.textContent?.trim().slice(0, 24)}"`
        )
    );
    expect(clipped, `clipped at ${width}px`).toEqual([]);
  }
});

/**
 * A URL the endpoint will refuse is worth catching on the page. It costs no
 * quota — the BFF answers INVALID_REQUEST before a dispatch is spent — but it
 * still costs a round trip and puts an error code where an answer belongs.
 *
 * Unlike the load warning, this carries no override. The endpoint's rule is
 * certain; the browser's is not, which is why one of the two is overridable and
 * the other is not.
 */
test("a chart URL the endpoint would reject cannot be submitted", async ({
  page,
  request,
}) => {
  await keepBrowserTrafficLocal(page);
  await resetScoringLog(request);
  await page.goto("/demo/scoring");
  await waitForHydration(page);

  // The prefilled sample is sendable.
  await expect(page.getByTestId("chart-url-problem")).toBeHidden();
  await expect(page.getByTestId("button-grade")).toBeEnabled();

  for (const bad of [
    "http://s3.wispace.app/chart.png",
    "https://user:pass@s3.wispace.app/c.png",
    "not a url",
    "",
  ]) {
    await page.getByTestId("input-image-url").fill(bad);
    await expect(page.getByTestId("chart-url-problem")).toBeVisible();
    await expect(page.getByTestId("button-grade")).toBeDisabled();
  }

  // Correcting it re-enables the button with no other action. The replacement
  // has to be one the mock actually serves: a well-formed URL the browser
  // cannot load is held by the other guard, which is a different failure with a
  // different answer.
  await page
    .getByTestId("input-image-url")
    .fill("https://s3.wispace.app/ielts-task1/ca95bd4ab522946e");
  await expect(page.getByTestId("chart-url-problem")).toBeHidden();
  await expect(page.getByTestId("button-grade")).toBeEnabled();

  // Nothing was sent while the field was refusing to be.
  expect((await scoringLog(request)).requests).toHaveLength(0);
});
