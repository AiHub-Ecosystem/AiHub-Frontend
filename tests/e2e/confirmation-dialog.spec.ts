import { expect, test, type Page } from "@playwright/test";
import { waitForHydration } from "./hydration";

const harnessPath = "/test-harness/confirmation-dialog";
const secondAppUrl = "http://127.0.0.1:3105";

async function openNestedConfirmation(page: Page, outcome = "success") {
  await page.goto(harnessPath);
  await waitForHydration(page);
  await page.getByRole("button", { name: "Open parent dialog" }).click();
  await page.getByLabel("Confirmation outcome").selectOption(outcome);
  const trigger = page.getByRole("button", {
    name: "Open nested confirmation",
  });
  await trigger.click();

  return {
    trigger,
    confirmation: page.getByRole("alertdialog", { name: "Remove record?" }),
  };
}

test("nested confirmation is accessible and restores focus after cancel", async ({
  page,
}) => {
  const { trigger, confirmation } = await openNestedConfirmation(page);

  await expect(confirmation).toContainText(
    "This will permanently remove the sample record."
  );
  await expect(confirmation.getByRole("button", { name: "Delete" })).toHaveCSS(
    "color",
    "rgb(180, 35, 24)"
  );
  await expect(
    confirmation.getByRole("button", { name: "Cancel" })
  ).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(
    confirmation.getByRole("button", { name: "Delete" })
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    confirmation.getByRole("button", { name: "Cancel" })
  ).toBeFocused();

  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Parent dialog" })
  ).toBeVisible();
  await expect(trigger).toBeFocused();
});

test("Escape closes only the idle nested confirmation", async ({ page }) => {
  const { trigger, confirmation } = await openNestedConfirmation(page);

  await expect(
    confirmation.getByRole("button", { name: "Cancel" })
  ).toBeFocused();
  await page.keyboard.press("Escape");

  await expect(confirmation).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Parent dialog" })
  ).toBeVisible();
  await expect(trigger).toBeFocused();
});

test("an Escape that lands while the confirmation mounts leaves the parent open", async ({
  page,
}) => {
  await page.goto(harnessPath);
  await waitForHydration(page);
  await page.getByRole("button", { name: "Open parent dialog" }).click();

  // Radix keeps the parent's document Escape listener attached until the render
  // after the nested dialog's mount, so an Escape inside that window reaches
  // the parent too. A mutation observer callback runs before React's passive
  // effects, which is exactly that window.
  await page.evaluate(async () => {
    const nested = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Open nested confirmation");
    const escaped = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        if (!document.querySelector('[role="alertdialog"]')) return;
        observer.disconnect();
        document.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
        );
        resolve();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    nested?.click();
    await escaped;
  });

  // The confirmation never saw that Escape, so it is still up and it hides
  // the parent from the accessibility tree.
  const confirmation = page.getByRole("alertdialog", {
    name: "Remove record?",
  });
  await expect(confirmation).toBeVisible();
  await expect(page.locator('[role="dialog"]')).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Parent dialog" })
  ).toBeVisible();
});

test("backdrop closes only the idle nested confirmation", async ({ page }) => {
  const { trigger, confirmation } = await openNestedConfirmation(page);

  await expect(confirmation).toBeVisible();
  // Radix attaches its outside-pointer listener a tick after the dialog is
  // visible, so an immediate click can land before it exists.
  await expect(async () => {
    await page.mouse.click(8, 8);
    await expect(confirmation).toHaveCount(0, { timeout: 500 });
  }).toPass();
  await expect(
    page.getByRole("dialog", { name: "Parent dialog" })
  ).toBeVisible();
  await expect(trigger).toBeFocused();
});

test("pending confirmation blocks dismissal and repeat submission", async ({
  page,
}) => {
  const { trigger, confirmation } = await openNestedConfirmation(page);
  const confirm = confirmation.getByRole("button", { name: "Delete" });

  await confirm.click();
  const pendingConfirm = confirmation.getByRole("button", {
    name: "Deleting…",
  });
  await expect(pendingConfirm).toBeDisabled();

  await page.keyboard.press("Escape");
  await page.mouse.click(8, 8);
  await expect(confirmation).toBeVisible();

  await expect(confirmation).toHaveCount(0, { timeout: 5_000 });
  await expect(
    page.getByRole("dialog", { name: "Parent dialog" })
  ).toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.getByLabel("Confirmation attempts")).toHaveText("1");
});

for (const outcome of ["false", "reject"]) {
  test(`confirmation stays open when the caller returns ${outcome}`, async ({
    page,
  }) => {
    const { confirmation } = await openNestedConfirmation(page, outcome);

    await confirmation.getByRole("button", { name: "Delete" }).click();

    await expect(confirmation.getByRole("alert")).toHaveText(
      outcome === "false"
        ? "The action was not accepted."
        : "The action could not be completed."
    );
    await expect(confirmation).toBeVisible();
    await expect(
      confirmation.getByRole("button", { name: "Cancel" })
    ).toBeEnabled();
  });
}

test("test harness is not available without E2E_TESTING", async ({
  request,
}) => {
  const response = await request.get(`${secondAppUrl}${harnessPath}`);

  expect(response.status()).toBe(404);
});
