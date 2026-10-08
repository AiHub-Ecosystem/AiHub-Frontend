import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  authenticatedAihubFetch: vi.fn(),
  originIsAllowed: vi.fn(),
  requireWebSession: vi.fn(),
  webSessionIdFromRequest: vi.fn(),
}));

vi.mock("@/lib/auth-session", () => auth);

import { GET as getRoster } from "@/app/api/organizations/me/members/route";
import { POST as createOrganization } from "@/app/api/organizations/route";
import { PATCH as renameOrganization } from "@/app/api/organizations/[organizationId]/route";

const sessionId = "s".repeat(43);

function request(
  method: string,
  body?: unknown,
  headers: Record<string, string> = {}
) {
  return new Request("http://localhost/api/organizations", {
    method,
    headers: {
      Origin: "http://localhost",
      Cookie: "__Host-aihub_web_session=test",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  auth.originIsAllowed.mockReturnValue(true);
  auth.requireWebSession.mockResolvedValue(null);
  auth.webSessionIdFromRequest.mockReturnValue(sessionId);
});

describe("Organization BFF", () => {
  it("requires a same-origin request before creation", async () => {
    auth.originIsAllowed.mockReturnValue(false);
    const response = await createOrganization(request("POST", { name: "Org" }));
    expect(response.status).toBe(403);
    expect(auth.authenticatedAihubFetch).not.toHaveBeenCalled();
  });

  it("trims a valid name and forwards it through the authenticated BFF with its key", async () => {
    auth.authenticatedAihubFetch.mockResolvedValue(
      Response.json({ data: { id: "org-1" } }, { status: 201 })
    );
    const response = await createOrganization(
      request(
        "POST",
        { name: "  My Org  " },
        { "Idempotency-Key": "a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab" }
      )
    );
    expect(response.status).toBe(201);
    expect(auth.authenticatedAihubFetch).toHaveBeenCalledWith(
      sessionId,
      "/v1/organizations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab",
        }),
        body: JSON.stringify({ name: "My Org" }),
      })
    );
  });

  it("rejects missing or malformed UUID v4 keys before calling AIHUB", async () => {
    for (const key of [
      undefined,
      "a1b2c3d4-e5f6-1a1b-8c2d-1234567890ab",
      "a1b2c3d4-e5f6-4a1b-1c2d-1234567890ab",
    ]) {
      const response = await createOrganization(
        request("POST", { name: "Org" }, key ? { "Idempotency-Key": key } : {})
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: { code: "IDEMPOTENCY_KEY_REQUIRED" },
      });
    }
    expect(auth.authenticatedAihubFetch).not.toHaveBeenCalled();
  });

  it("requires a Web Session before creation", async () => {
    const denied = Response.json(
      { error: { code: "UNAUTHORIZED" } },
      { status: 401 }
    );
    auth.requireWebSession.mockResolvedValue(denied);
    const response = await createOrganization(
      request(
        "POST",
        { name: "Org" },
        {
          "Idempotency-Key": "a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab",
        }
      )
    );
    expect(response).toBe(denied);
    expect(auth.authenticatedAihubFetch).not.toHaveBeenCalled();
  });

  it("maps the Organization Creation Limit denial", async () => {
    auth.authenticatedAihubFetch.mockResolvedValue(
      Response.json(
        { error: { code: "ORGANIZATION_CREATION_LIMIT_REACHED" } },
        { status: 409 }
      )
    );
    const response = await createOrganization(
      request(
        "POST",
        { name: "Org" },
        { "Idempotency-Key": "a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab" }
      )
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "ORGANIZATION_CREATION_LIMIT_REACHED" },
    });
  });

  it("returns roster failures as retryable errors", async () => {
    auth.authenticatedAihubFetch.mockResolvedValue(
      new Response(null, { status: 503 })
    );
    const response = await getRoster(request("GET"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      success: false,
      error: { code: "ORGANIZATION_ROSTER_UNAVAILABLE" },
    });
  });

  it("hides whether a denied rename target exists", async () => {
    auth.authenticatedAihubFetch.mockResolvedValue(
      new Response(null, { status: 403 })
    );
    const response = await renameOrganization(
      request("PATCH", { name: "New Name" }),
      {
        params: Promise.resolve({ organizationId: "org-1" }),
      }
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });
});
