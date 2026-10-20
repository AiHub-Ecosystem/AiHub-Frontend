// Issue #100 spike: tRPC at the browser-to-Customer Web BFF seam.
//
// One scenario matrix, run twice: once against the current REST route and once
// against the tRPC prototype. The fake AIHUB upstream is the E2E mock, so the
// upstream side of every case is contract-validated against the pinned OpenAPI.
//
// Nothing here runs in production: the prototype lives in `spikes/`, is not
// mounted under `app/`, and no caller is switched to it.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTRPCClient, httpLink } from "@trpc/client";

import { POST as createOrganizationRoute } from "@/app/api/organizations/route";
import { spikeHandler } from "@/spikes/trpc-bff/handler";
import type { SpikeRouter } from "@/spikes/trpc-bff/router";
import { startSeam, type Seam } from "./support/seam-harness";

const IDEMPOTENCY_KEY = "a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab";
const CLEAR_SESSION_COOKIE =
  "__Host-aihub_web_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict";

let seam: Seam;
let sessionToken: string;

function browserHeaders(extra: Record<string, string> = {}) {
  return {
    Origin: seam.bffOrigin,
    Cookie: `__Host-aihub_web_session=${sessionToken}`,
    "Idempotency-Key": IDEMPOTENCY_KEY,
    ...extra,
  };
}

beforeAll(async () => {
  seam = await startSeam({
    rest: createOrganizationRoute,
    trpc: spikeHandler,
  });
}, 30_000);

beforeEach(async () => {
  await seam.reset();
  sessionToken = await seam.signIn();
});

afterAll(async () => {
  await seam?.close();
});

describe.each(["rest", "trpc"])(
  "%s transport at the browser-to-BFF seam",
  (name) => {
    const call = (body: unknown, headers: Record<string, string>) =>
      (name === "rest" ? seam.rest : seam.trpc).create(body, headers);

    it("refuses a cross-origin request with 403 and never calls AIHUB", async () => {
      const before = await seam.createRequests();
      const response = await call(
        { name: "Org" },
        browserHeaders({ Origin: "http://attacker.test" })
      );
      expect(response.status).toBe(403);
      expect(await seam.createRequests()).toHaveLength(before.length);
    });

    it("rejects an invalid Organization name with 400 before calling AIHUB", async () => {
      const before = await seam.createRequests();
      const response = await call({ name: "   " }, browserHeaders());
      expect(response.status).toBe(400);
      expect(
        (name === "rest" ? seam.rest : seam.trpc).bffCode(await response.json())
      ).toBe("INVALID_NAME");
      expect(await seam.createRequests()).toHaveLength(before.length);
    });

    it("rejects an invalid idempotency key with 400 before calling AIHUB", async () => {
      const before = await seam.createRequests();
      const response = await call(
        { name: "Org" },
        browserHeaders({ "Idempotency-Key": "not-a-uuid" })
      );
      expect(response.status).toBe(400);
      expect(
        (name === "rest" ? seam.rest : seam.trpc).bffCode(await response.json())
      ).toBe("IDEMPOTENCY_KEY_REQUIRED");
      expect(await seam.createRequests()).toHaveLength(before.length);
    });

    it("answers a missing Web Session before parsing a malformed body", async () => {
      const response = await (name === "rest" ? seam.rest : seam.trpc).raw(
        "{not json",
        browserHeaders({ Cookie: "" })
      );
      expect(response.status).toBe(401);
      expect(response.headers.get("set-cookie")).toBe(CLEAR_SESSION_COOKIE);
    });

    it("answers a rejected Web Session with 401 and clears the session cookie", async () => {
      const response = await call(
        { name: "Org" },
        browserHeaders({ Cookie: `__Host-aihub_web_session=${"e".repeat(43)}` })
      );
      expect(response.status).toBe(401);
      expect(response.headers.get("set-cookie")).toBe(CLEAR_SESSION_COOKIE);
    });

    it("answers an expired Web Session before parsing a malformed body", async () => {
      await fetch(`${seam.upstreamUrl}/__test__/auth/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionExchangeUnauthorized: true }),
      });
      const response = await (name === "rest" ? seam.rest : seam.trpc).raw(
        "{not json",
        browserHeaders()
      );
      expect(response.status).toBe(401);
      expect(response.headers.get("set-cookie")).toBe(CLEAR_SESSION_COOKIE);
    });

    it("creates the Organization with a trimmed name and the caller's idempotency key", async () => {
      const response = await call({ name: "  My Org  " }, browserHeaders());
      expect(response.status).toBe(201);
      expect(
        (name === "rest" ? seam.rest : seam.trpc).organizationId(
          await response.json()
        )
      ).toBe("org-created-12345678");
      const requests = await seam.createRequests();
      expect(requests.at(-1)).toMatchObject({
        name: "My Org",
        idempotencyKey: IDEMPOTENCY_KEY,
      });
    });

    it("keeps the Organization Creation Limit conflict on 409", async () => {
      await seam.configure({ creationLimit: true });
      const response = await call({ name: "Org" }, browserHeaders());
      expect(response.status).toBe(409);
      expect(
        (name === "rest" ? seam.rest : seam.trpc).bffCode(await response.json())
      ).toBe("ORGANIZATION_CREATION_LIMIT_REACHED");
    });

    it("keeps an upstream idempotency conflict on 409", async () => {
      await seam.configure({ createConflictOnce: true });
      const response = await call({ name: "Org" }, browserHeaders());
      expect(response.status).toBe(409);
      expect(
        (name === "rest" ? seam.rest : seam.trpc).bffCode(await response.json())
      ).toBe("IDEMPOTENCY_CONFLICT");
    });

    it("keeps an upstream outage on 503", async () => {
      await seam.configure({ createUnavailable: true });
      const response = await call({ name: "Org" }, browserHeaders());
      expect(response.status).toBe(503);
      expect(
        (name === "rest" ? seam.rest : seam.trpc).bffCode(await response.json())
      ).toBe("LOCAL_MOCK_OUTAGE");
    });

    it("answers an ambiguous upstream answer with 503", async () => {
      await seam.configure({ createUncertainOnce: true });
      const response = await call({ name: "Org" }, browserHeaders());
      expect(response.status).toBe(503);
      expect(
        (name === "rest" ? seam.rest : seam.trpc).bffCode(await response.json())
      ).toBe("ORGANIZATION_CREATE_UNAVAILABLE");
    });

    it("retries an ambiguous creation with the same key without a second Organization", async () => {
      await seam.configure({ createUncertainOnce: true });

      const ambiguous = await call({ name: "Retry Org" }, browserHeaders());
      expect(ambiguous.status).toBe(503);
      expect(
        (name === "rest" ? seam.rest : seam.trpc).bffCode(
          await ambiguous.json()
        )
      ).toBe("ORGANIZATION_CREATE_UNAVAILABLE");

      const retried = await call({ name: "Retry Org" }, browserHeaders());
      expect(retried.status).toBe(201);
      expect(
        (name === "rest" ? seam.rest : seam.trpc).organizationId(
          await retried.json()
        )
      ).toBe("org-created-12345678");

      const { organizations } = await seam.upstreamState();
      expect(organizations).toHaveLength(1);
    });

    it("maps an upstream body-read failure to 503 and retries safely", async () => {
      await seam.configure({ createBodyReadFailureOnce: true });

      const interrupted = await call({ name: "Retry Org" }, browserHeaders());
      expect(interrupted.status).toBe(503);
      expect(
        (name === "rest" ? seam.rest : seam.trpc).bffCode(
          await interrupted.json()
        )
      ).toBe("ORGANIZATION_CREATE_UNAVAILABLE");

      const retried = await call({ name: "Retry Org" }, browserHeaders());
      expect(retried.status).toBe(201);
      expect(
        (name === "rest" ? seam.rest : seam.trpc).organizationId(
          await retried.json()
        )
      ).toBe("org-created-12345678");
      const requests = await seam.createRequests();
      expect(requests).toHaveLength(2);
      expect(
        requests.map(({ name, idempotencyKey }) => ({ name, idempotencyKey }))
      ).toEqual([
        { name: "Retry Org", idempotencyKey: IDEMPOTENCY_KEY },
        { name: "Retry Org", idempotencyKey: IDEMPOTENCY_KEY },
      ]);

      const { organizations } = await seam.upstreamState();
      expect(organizations).toHaveLength(1);
    });
  }
);

describe("the tRPC wire format", () => {
  it("rejects malformed cross-origin bodies before parsing on both transports", async () => {
    const before = await seam.createRequests();
    for (const transport of [seam.rest, seam.trpc]) {
      const response = await transport.raw(
        "{not json",
        browserHeaders({ Origin: "http://attacker.test" })
      );
      expect(response.status).toBe(403);
      expect(await response.text()).toBe("");
    }
    expect(await seam.createRequests()).toHaveLength(before.length);
  });

  it("answers a malformed body with 400 on both transports", async () => {
    for (const transport of [seam.rest, seam.trpc]) {
      const response = await transport.raw("{not json", browserHeaders());
      expect(response.status).toBe(400);
    }
  });

  it("answers a successful creation with the current body nested in the tRPC envelope", async () => {
    const response = await seam.trpc.create(
      { name: "My Org" },
      browserHeaders()
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      result: {
        data: {
          data: { organization: { organization_id: "org-created-12345678" } },
        },
      },
    });
  });

  it("serves the typed tRPC client", async () => {
    const client = createTRPCClient<SpikeRouter>({
      links: [
        httpLink({
          url: `${seam.bffUrl}/trpc`,
          headers: () => browserHeaders(),
        }),
      ],
    });
    const created = await client.organizations.create.mutate({
      name: "Typed Org",
    });
    expect(created.data.organization.organization_id).toBe(
      "org-created-12345678"
    );
  });

  it("gives the typed client the BFF's own error code", async () => {
    const client = createTRPCClient<SpikeRouter>({
      links: [
        httpLink({
          url: `${seam.bffUrl}/trpc`,
          headers: () => browserHeaders(),
        }),
      ],
    });
    await expect(
      client.organizations.create.mutate({ name: "   " })
    ).rejects.toMatchObject({
      data: { bffCode: "INVALID_NAME", httpStatus: 400 },
    });
  });

  it("collapses a batch whose calls disagree on status into one response status", async () => {
    const response = await fetch(
      `${seam.bffUrl}/trpc/organizations.create,organizations.create?batch=1`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...browserHeaders(),
        },
        // The accepted call of the batch creates one Organization upstream.
        body: JSON.stringify({
          0: { name: "   " },
          1: { name: "Batched Org" },
        }),
      }
    );
    expect(response.status).toBe(207);
    const body = await response.json();
    expect(body[0]).toMatchObject({
      error: { data: { bffCode: "INVALID_NAME", httpStatus: 400 } },
    });
    expect(body[1]).toMatchObject({
      result: { data: { data: { organization: { name: "Batched Org" } } } },
    });
  });
});
