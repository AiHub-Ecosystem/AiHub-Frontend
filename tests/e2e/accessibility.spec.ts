import axe from "axe-core";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { waitForHydration } from "./hydration";

const mockUrl = "http://127.0.0.1:3101";
const password = "correct horse battery staple";
const organizationId = "org-a11y-12345678";

/** WCAG 2.0, 2.1 and 2.2 at levels A and AA: what axe can decide by itself. */
const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Runs axe over the whole page. The wordmark is left out of the contrast rule
 * only: WCAG 1.4.3 sets no contrast minimum for text that is part of a logo.
 */
async function violations(page: Page) {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async (tags) => {
    // A dialog that is still fading in has colours between its start and end
    // states; measuring then reports contrast the settled page never shows.
    await Promise.all(document.getAnimations().map((a) => a.finished));
    const result = await window.axe.run(
      { exclude: [[".aihub-logo-text"]] },
      { runOnly: { type: "tag", values: tags } }
    );
    return result.violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }));
  }, WCAG_AA_TAGS);
}

async function setup(request: APIRequestContext) {
  await request.post(`${mockUrl}/__test__/auth/reset`);
  await request.post(`${mockUrl}/__test__/organizations/config`, {
    data: {
      roster: [
        {
          organization_id: organizationId,
          name: "Accessibility Org",
          status: "active",
          identity_configured: false,
          entitlements: ["writing", "speaking"],
          membership: { role: "owner" },
          members: [{ username: "owner", role: "owner" }],
        },
      ],
    },
  });
}

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  // ponytail: a click before hydration is silently lost; slower shards lose the race.
  await waitForHydration(page);
  await page.getByLabel("Email").fill("valid@example.test");
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/console/orgs/${organizationId}$`));
}

for (const path of [
  "/login",
  "/register",
  "/forgot-password",
  "/demo",
  "/docs",
]) {
  test(`${path} has no WCAG A or AA violations axe can detect`, async ({
    page,
  }) => {
    await page.goto(path);
    await waitForHydration(page);
    expect(await violations(page)).toEqual([]);
  });
}

test("the signed-in Console has no WCAG A or AA violations axe can detect", async ({
  page,
  request,
}) => {
  await setup(request);
  await signIn(page);
  const found: Record<string, Awaited<ReturnType<typeof violations>>> = {};
  for (const path of [
    `/console/orgs/${organizationId}`,
    `/console/orgs/${organizationId}/api-keys`,
    `/console/orgs/${organizationId}/identity`,
    "/lab",
  ]) {
    await page.goto(path);
    await waitForHydration(page);
    const pageViolations = await violations(page);
    if (pageViolations.length > 0) found[path] = pageViolations;
  }
  expect(found).toEqual({});
});

declare global {
  interface Window {
    axe: typeof axe;
  }
}
