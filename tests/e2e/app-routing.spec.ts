import { expect, test } from "@playwright/test";

test("landing root and legacy auth links route to their app owners", async ({
  request,
}) => {
  const landing = await request.get("http://127.0.0.1:3102/");
  expect(landing.ok()).toBeTruthy();
  expect(await landing.text()).toContain("Hệ sinh thái API AI");

  for (const route of ["verify-email?token=old", "reset-password?token=old"]) {
    const response = await request.get(`http://127.0.0.1:3102/${route}`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(308);
    const location = new URL(response.headers().location!);
    expect(location.pathname + location.search).toBe(`/app/${route}`);
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response.headers()["cache-control"]).toContain("no-store");
  }

  const app = await request.get("http://127.0.0.1:3100/app/login");
  expect(app.ok()).toBeTruthy();

  const appRoot = await request.get("http://127.0.0.1:3100/app", {
    maxRedirects: 0,
  });
  expect(appRoot.status()).toBe(307);
  expect(appRoot.headers().location).toBe("/app/console");
});
