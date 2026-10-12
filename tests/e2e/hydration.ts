import type { Page } from "@playwright/test";

/**
 * Waits until React has hydrated the current document. A dev server can fire
 * `load` before hydration, and a click on a server-rendered button before then
 * is silently lost.
 */
export async function waitForHydration(page: Page) {
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
}
