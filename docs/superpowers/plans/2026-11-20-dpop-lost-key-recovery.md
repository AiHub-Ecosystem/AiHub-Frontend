# DPoP lost-key recovery and rollout (#124) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect a replaced browser proof key in the Customer Web BFF, force a fresh sign-in without re-registering a key, and document the `verify` → `enforce` rollout.

**Architecture:** Store the RFC 7638 thumbprint of the bound `client_proof_key` in the BFF WebSession cache. `getCurrentWebSession` compares the incoming key's thumbprint on every call; a mismatch drops the cache and returns `null`, which existing callers turn into a login redirect. No new client state, no env flag.

**Tech Stack:** Next.js App Router BFF (Node `crypto`), Vitest unit tests, Playwright E2E with the in-repo mock AIHUB server.

## Global Constraints

- AIHUB ADR-0176: no key re-registration against an existing Web Session; key changes require a new sign-in.
- Thumbprint must be byte-identical to AIHUB's: SHA-256 of `JSON.stringify({crv,kty,x,y})`, base64url, no padding.
- `token_type` stays `Bearer`; only `dpop_bound` selects the DPoP scheme.
- Direct BFF/test requests without a proof-key cookie keep Bearer and are not treated as a mismatch.
- No new environment variables.

---

### Task 1: BFF mismatch detection + unit tests

**Files:**

- Modify: `apps/customer-web/lib/auth-session.ts` (imports, `WebSession`, `exchangeWebSession`, `getCurrentWebSession`)
- Modify: `tests/unit/auth-session.test.ts` (cleanup token list + 2 new tests)

**Interfaces:**

- Consumes: `PublicProofKey` from `@/lib/public-proof-key.mjs`; existing `sessions` map and `exchangeWebSession`.
- Produces: `WebSession.boundThumbprint: string | null`; `getCurrentWebSession` returns `null` on key mismatch without issuing an exchange.

- [ ] **Step 1: Write failing unit tests**

Append to `tests/unit/auth-session.test.ts` (inside the existing `describe`):

```ts
it("drops a bound session and skips exchange when the browser key changes", async () => {
  process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
  const sessionToken = "k".repeat(43);
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      data: {
        access_token: "jwt-bound",
        token_type: "Bearer",
        expires_in: aihubLimits.webSessionAccessTokenMaxSeconds,
        dpop_bound: true,
      },
    })
  );
  expect(
    await getCurrentWebSession(sessionToken, undefined, proofKey)
  ).not.toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);

  const replaced: PublicProofKey = { ...proofKey, x: "z".repeat(43) };
  expect(
    await getCurrentWebSession(sessionToken, undefined, replaced)
  ).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1); // no re-registration exchange
  expect(cachedWebSessionCount()).toBe(0);
});

it("keeps a bound session for a direct request with no proof key", async () => {
  process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
  const sessionToken = "b".repeat(43);
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      data: {
        access_token: "jwt-bound",
        token_type: "Bearer",
        expires_in: aihubLimits.webSessionAccessTokenMaxSeconds,
        dpop_bound: true,
      },
    })
  );
  expect(
    await getCurrentWebSession(sessionToken, undefined, proofKey)
  ).not.toBeNull();
  expect(await getCurrentWebSession(sessionToken, undefined)).not.toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});
```

Add `"k".repeat(43)` and `"b".repeat(43)` to the `afterEach` cleanup token list.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/auth-session.test.ts`
Expected: first test fails (`toBeNull()` receives the cached session; `fetch` called twice).

- [ ] **Step 3: Implement the thumbprint and mismatch guard**

In `apps/customer-web/lib/auth-session.ts`, add `import { createHash } from "node:crypto";` at the top, then add:

```ts
function proofKeyThumbprint(key: PublicProofKey) {
  // RFC 7638 over the closed P-256 JWK; byte-identical to AIHUB ADR-0176.
  return createHash("sha256")
    .update(JSON.stringify({ crv: key.crv, kty: key.kty, x: key.x, y: key.y }))
    .digest("base64url");
}
```

Extend `WebSession` with `boundThumbprint: string | null`. In `exchangeWebSession`, set:
`boundThumbprint: proofKey ? proofKeyThumbprint(proofKey) : null`.

In `getCurrentWebSession`, immediately after `let cached = sessions.get(token);` insert:

```ts
if (
  cached?.dpopBound &&
  proofKey &&
  proofKeyThumbprint(proofKey) !== cached.boundThumbprint
) {
  sessions.delete(token);
  return null;
}
```

Keep the existing unbound→bound re-exchange rule below it unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/auth-session.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/customer-web/lib/auth-session.ts tests/unit/auth-session.test.ts
git commit -m "fix(auth): force re-sign-in when the bound proof key changes (#124)"
```

---

### Task 2: Mock probe + browser recovery test

**Files:**

- Modify: `tests/e2e/mock-aihub-server.mjs` (record exchange thumbprint; expose via test helper)
- Modify: `tests/e2e/auth.spec.ts` (new browser test)

**Interfaces:**

- Consumes: `isPublicProofKey` from `apps/customer-web/lib/public-proof-key.mjs`; existing `authRequests` array and `__test__` endpoints.
- Produces: exchange records include `proofKeyThumbprint`; a browser test that deletes the key, is redirected to login, and recovers.

- [ ] **Step 1: Add a failing browser test**

Append to `tests/e2e/auth.spec.ts`:

```ts
test("a lost proof key forces re-sign-in and a new key is bound", async ({
  page,
  request,
}) => {
  await resetAuthMock(request);
  await page.goto("/app/login");
  await waitForHydration(page);
  await page.getByLabel("Email").fill("valid@example.test");
  await page.getByLabel("Mật khẩu").fill(validPassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/console\/orgs$/);
  await waitForHydration(page);

  // Replace the browser key without touching the Web Session cookie.
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const drop = indexedDB.deleteDatabase("aihub-web-proof-key");
      drop.onsuccess = () => resolve();
      drop.onerror = () => reject(drop.error);
    });
    sessionStorage.clear();
  });
  await page.goto("/app/console/orgs");
  await expect(page).toHaveURL(/\/app\/login\?error=session/u);

  // No exchange may have re-bound a key for the abandoned session.
  const exchanges = await exchangeRecords(request);
  expect(exchanges.filter((entry) => entry.proofKeyThumbprint)).toHaveLength(1);

  await page.getByLabel("Email").fill("valid@example.test");
  await page.getByLabel("Mật khẩu").fill(validPassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/console\/orgs$/);
  await expect(
    page.getByRole("heading", { name: "Organizations", exact: true })
  ).toBeVisible();
});
```

Define `exchangeRecords` as a small helper using the mock's exposed `__test__/auth/requests` endpoint, mirroring the existing helper pattern in the file. Compute `proofKeyThumbprint` in the mock from `body.client_proof_key` with the same canonical JSON + SHA-256 base64url as Task 1.

- [ ] **Step 2: Run the browser test to verify it fails**

Run: `npx playwright test tests/e2e/auth.spec.ts -g "lost proof key"` (with the repo's webServer config).
Expected: FAIL — the BFF has no mismatch guard yet, so the page stays on Console.

- [ ] **Step 3: Verify it passes with Task 1 in place**

Run the same command. Expected: PASS. If the redirect needs a second navigation because the cookie is installed after hydration, add an explicit `page.reload()` before the URL assertion and keep the no-re-registration assertion.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/mock-aihub-server.mjs tests/e2e/auth.spec.ts
git commit -m "test(e2e): cover lost proof key recovery and no re-registration (#124)"
```

---

### Task 3: Rollout documentation

**Files:**

- Modify: `docs/releases/0024-customer-web-aihub-1.18.0.md`

- [ ] **Step 1: Replace the placeholder with the concrete rollout order**

Rewrite the final bullet as three numbered steps: Deploy AIHUB at `off` then `verify` (Customer Web sends `client_proof_key` and uses DPoP when `dpop_bound: true`); move to `enforce` only after `sum(increase(aihub_user_access_token_use_total{scheme="bearer",session="web"}[<owner-selected window>]))` is zero over the chosen window aggregated across app instances; rollback to `off`/older images requires Bearer and a bound token stays usable as Bearer there.

- [ ] **Step 2: Verify no placeholder text remains**

Run: `grep -n "owned by \[ #124 \]" docs/releases/0024-customer-web-aihub-1.18.0.md`
Expected: no match.

- [ ] **Step 3: Commit**

```bash
git add docs/releases/0024-customer-web-aihub-1.18.0.md
git commit -m "docs: record verify to enforce rollout order (#124)"
```

---

### Task 4: Full gates and push

- [ ] **Step 1: Run local gates**

Run: `npx tsc --noEmit && npm test`
Expected: type check clean, all unit tests pass.

- [ ] **Step 2: Push and watch CI**

```bash
git push origin dev
gh run list -R AiHub-Ecosystem/AiHub-Frontend --branch dev --limit 1 --json databaseId,status,headSha,url
gh run watch <id> -R AiHub-Ecosystem/AiHub-Frontend --interval 20 --exit-status
```

Expected: Browser tests, Fast checks, and Deploy production all green.

- [ ] **Step 3: Verify production and close the issue**

Fetch `https://aihubproduction.com/app/login`, extract the 40-hex RSC build id, and confirm it matches the deployed `dev` HEAD. Comment the evidence on #123-style format, then close #124 with reason `completed` only after CI is green.

## Self-Review

- Spec coverage: Task 1 = detection + no re-registration; Task 2 = browser acceptance criteria; Task 3 = rollout doc; Task 4 = unit/browser green + close. All criteria covered.
- Placeholders: the `<owner-selected window>` string is copied verbatim from ADR-0176 (the owner chooses it), not an implementation placeholder.
- Type consistency: `boundThumbprint: string | null` defined in Task 1 and consumed there only; `proofKeyThumbprint` name used in both mock and BFF.
