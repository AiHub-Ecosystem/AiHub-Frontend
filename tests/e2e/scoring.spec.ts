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

async function openWriting(
  page: Page,
  { mode = "mock", task = 1, step = 4 }: { mode?: "mock" | "live"; task?: 1 | 2; step?: 2 | 3 | 4 } = {},
) {
  await waitForHydration(page);
  if (mode === "live") {
    await page.getByLabel("API key Sandbox (tùy chọn)").fill("aihub_sk_e2e_sandbox_key");
    await page.getByRole("button", { name: "Kiểm tra key" }).click();
    await expect(page.getByRole("heading", { name: "Chọn bài Writing" })).toBeVisible();
  } else {
    await page.getByRole("button", { name: "Bỏ qua, dùng mẫu" }).click();
  }
  if (task === 2) await page.getByTestId("tab-task-2").click();
  if (step >= 3) {
    await page.getByRole("button", { name: "Tiếp tục đến bài làm" }).click();
  }
  if (step >= 4) await page.getByRole("button", { name: "Xem bước chấm" }).click();
}

async function gradeWriting(
  page: Page,
  options: { mode?: "mock" | "live"; task?: 1 | 2 } = {},
) {
  await openWriting(page, { ...options, step: 4 });
  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toBeVisible();
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
  await expect(page.locator("main.aihub-demo-flow")).toBeVisible();
});

test("grades the prefilled Task 1 sample without a login", async ({
  page,
  request,
}) => {
  const assertNoExternalTraffic = await keepBrowserTrafficLocal(page);
  const failed: string[] = [];
  page.on("pageerror", (error) => failed.push(error.message));

  await page.goto("/demo/scoring");
  await openWriting(page, { step: 3 });

  // The page must be runnable with no typing.
  const essay = await page.getByTestId("input-essay").inputValue();
  expect(essay.length).toBeGreaterThan(500);
  expect(essay).toContain("The bar chart illustrates");
  await expect(page.getByTestId("select-chart-type")).toHaveValue("Bar Chart");
  await expect(page.getByTestId("input-image-url")).toHaveValue(/^https:\/\//);
  await expect(page.getByTestId("input-essay")).toHaveAttribute("readonly", "");

  await page.getByRole("button", { name: "Xem bước chấm" }).click();
  await page.getByTestId("button-grade").click();
  await expect(page.getByTestId("scoring-report")).toBeVisible();

  // Mock grading is local and never reaches the upstream scoring service.
  const log = await scoringLog(request);
  expect(log.requests).toHaveLength(0);
  await page.getByRole("tab", { name: "Response" }).click();
  await expect(page.locator(".demo-console-code")).toContainText("local fixed fixture");
  await expect(page.locator(".demo-console-code")).toContainText("overall_band");

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
  await gradeWriting(page, { mode: "live" });

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
  await gradeWriting(page, { mode: "live" });

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
  await gradeWriting(page, { mode: "live" });

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
  await gradeWriting(page, { mode: "live" });

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
  await gradeWriting(page, { mode: "live" });
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

test("both demo workbenches keep the AIHUB brand palette", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);

  const tokens = await page
    .locator("main.aihub-demo-flow")
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return [
        s.getPropertyValue("--demo-brand").trim(),
        s.getPropertyValue("--demo-ink").trim(),
      ];
    });
  expect(tokens).toEqual(["#3a64fa", "#1d2838"]);

  await page.goto("/demo/speaking");
  const speakingBrand = await page
    .locator("main.aihub-demo-flow")
    .first()
    .evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--demo-brand").trim()
    );
  expect(speakingBrand).toBe(tokens[0]);
});

test("a rejected submission shows its code and no credential leaked", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);

  await page.getByLabel("API key Sandbox (tùy chọn)").fill("invalid-sandbox-key");
  await page.getByRole("button", { name: "Kiểm tra key" }).click();

  const error = page.getByRole("alert");
  await expect(error).toBeVisible();
  await expect(error).toContainText("UNAUTHORIZED");
  await expect(page.getByRole("heading", { name: "Kết nối Sandbox" })).toBeVisible();
});

test("Writing grading rejects an invalid key even when the client skips validation", async ({
  page,
  request,
}) => {
  await page.goto("/demo/scoring");
  await openWriting(page, { mode: "live", step: 2 });

  const result = await page.evaluate(async () => {
    const response = await fetch("/api/demo/scoring/grade", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Demo-API-Key": "invalid-sandbox-key",
        "X-Demo-User-Identity": "00000000-0000-4000-8000-000000000001",
      },
      body: JSON.stringify({
        task: 1,
        question: "Summarise the chart.",
        essay: "The bar chart shows telephone calls in the UK.",
        chart_type: "Bar Chart",
        image_url: "https://s3.wispace.app/ielts-task1/ca95bd4ab522946e",
      }),
    });
    return { status: response.status, body: await response.json() };
  });

  expect(result.status).toBe(401);
  expect(result.body).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  expect((await scoringLog(request)).requests).toHaveLength(0);
});

test("the Task 2 tab opens without a page load and survives a return visit", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);

  await page.getByRole("button", { name: "Bỏ qua, dùng mẫu" }).click();
  // Nothing navigates: the task selector is a client transition in one document.
  await page.evaluate(() => {
    (window as unknown as { __stayed: boolean }).__stayed = true;
  });
  await page.getByTestId("tab-task-2").click();
  await expect(page).toHaveURL(/\/demo\/scoring$/);
  expect(
    await page.evaluate(
      () => (window as unknown as { __stayed?: boolean }).__stayed
    )
  ).toBe(true);

  await page.getByTestId("tab-task-1").click();
  await page.getByTestId("tab-task-2").click();
  await expect(page.getByTestId("tab-task-2")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("input-topic")).toBeVisible();
});

test("live Task 2 grading sends topic and no Task 1 field", async ({
  page,
  request,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await openWriting(page, { mode: "live", task: 2, step: 3 });

  const essay = await page.getByTestId("input-essay").inputValue();
  expect(essay.length).toBeGreaterThan(500);
  expect(essay).toContain("Universities have traditionally focused");
  await expect(page.getByTestId("input-topic")).toHaveValue("education");
  await expect(page.getByTestId("input-question")).toHaveValue(/vocational/);

  await page.getByRole("button", { name: "Xem bước chấm" }).click();
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
  await page.goto("/demo/scoring");
  await gradeWriting(page, { mode: "live", task: 2 });

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
    .locator("main.aihub-demo-flow")
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
  await page.goto("/demo/scoring");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Bỏ qua, dùng mẫu" }).click();
  await page.getByTestId("tab-task-2").click();

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
  await gradeWriting(page, { mode: "live" });
  await expect(page.getByTestId("scoring-report")).toContainText(
    "Báo cáo chấm bài Task 1"
  );

  await page.getByRole("button", { name: /2 Chọn đề/ }).click();
  await page.getByTestId("tab-task-2").click();
  await page.getByRole("button", { name: "Tiếp tục đến bài làm" }).click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();
  // A report belongs to the task that produced it.
  await expect(page.getByTestId("scoring-report")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Gửi chấm live" })).toBeVisible();
});

test("the four criteria fit a phone without horizontal scrolling", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/scoring");
  await waitForHydration(page);
  await gradeWriting(page);

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

  await gradeWriting(page);
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
  await gradeWriting(page);
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
      const panel = document.querySelector(".demo-console");
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
test("the visitor can leave the optional Sandbox key empty", async ({ page }) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);

  await expect(page.getByLabel("API key Sandbox (tùy chọn)")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Bỏ qua, dùng mẫu" })).toBeEnabled();

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
    .locator(".aihub-demo-flow :is(h1, h2, h3, h4, h5, h6)")
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
    await gradeWriting(page, { mode: "live" });

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

test("the Request and Response console updates at every step", async ({
  page,
}) => {
  await keepBrowserTrafficLocal(page);
  await page.goto("/demo/scoring");
  await waitForHydration(page);
  const code = page.locator(".demo-console-code");
  await expect(code).toContainText("key optional");
  await page.getByRole("tab", { name: "Response" }).click();
  await expect(code).toContainText("Chưa kiểm tra key");

  await page.getByRole("button", { name: "Bỏ qua, dùng mẫu" }).click();
  await page.getByRole("tab", { name: "Request" }).click();
  await expect(code).toContainText("local fixture");
  await page.getByRole("tab", { name: "Response" }).click();
  await expect(code).toContainText("local fixture");

  await page.getByRole("button", { name: "Tiếp tục đến bài làm" }).click();
  await page.getByRole("tab", { name: "Request" }).click();
  await expect(code).toContainText("read-only fixture");
  await page.getByRole("tab", { name: "Response" }).click();
  await expect(code).toContainText("local draft preview");

  await page.getByRole("button", { name: "Xem bước chấm" }).click();
  await page.getByRole("tab", { name: "Request" }).click();
  await expect(code).toContainText("local fixed fixture");
  await page.getByRole("tab", { name: "Response" }).click();
  await page.getByTestId("button-grade").click();
  await expect(code).toContainText("overall_band");
});

/** Check report content at both stacked and side-by-side breakpoints. */
test("the report is never clipped, at any width", async ({ page }) => {
  await keepBrowserTrafficLocal(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/demo/scoring");
  await gradeWriting(page);

  for (const width of [1440, 1200, 1061, 1060, 1020, 1001, 900, 768]) {
    await page.setViewportSize({ width, height: 900 });

    const clipped = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-testid=scoring-report] *"))
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

/** Invalid chart URLs are blocked before a live grading request can be sent. */
test("a chart URL the endpoint would reject cannot be submitted", async ({
  page,
  request,
}) => {
  await keepBrowserTrafficLocal(page);
  await resetScoringLog(request);
  await page.goto("/demo/scoring");
  await openWriting(page, { mode: "live", step: 2 });

  // The prefilled sample is valid.
  await expect(page.getByTestId("chart-url-problem")).toBeHidden();

  for (const bad of [
    "http://s3.wispace.app/chart.png",
    "https://user:pass@s3.wispace.app/c.png",
    "not a url",
    "",
  ]) {
    await page.getByTestId("input-image-url").fill(bad);
    await expect(page.getByTestId("chart-url-problem")).toBeVisible();
  }

  await page.getByRole("button", { name: "Tiếp tục đến bài làm" }).click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();
  await expect(page.getByTestId("button-grade")).toBeDisabled();

  // Correcting the value clears the warning and restores the grading action.
  await page.getByRole("button", { name: "Sửa bài" }).click();
  await page.getByRole("button", { name: "Quay lại đề" }).click();
  await page
    .getByTestId("input-image-url")
    .fill("https://s3.wispace.app/ielts-task1/ca95bd4ab522946e");
  await expect(page.getByTestId("chart-url-problem")).toBeHidden();
  await page.getByRole("button", { name: "Tiếp tục đến bài làm" }).click();
  await page.getByRole("button", { name: "Xem bước chấm" }).click();
  await expect(page.getByTestId("button-grade")).toBeEnabled();

  // Nothing was sent while the field was refusing to be.
  expect((await scoringLog(request)).requests).toHaveLength(0);
});
