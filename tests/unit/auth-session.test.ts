import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import aihubLimits from "@/data/aihub-contract/limits.json";
import { POST as createOrganization } from "@/app/api/organizations/route";
import { POST as activity } from "@/app/api/auth/session/route";
import {
  authenticatedAihubFetch,
  cachedWebSessionCount,
  clearWebSessionCache,
  getCurrentWebSession,
} from "@/lib/auth-session";
import {
  proofKeyCookie,
  type PublicProofKey,
} from "@/lib/public-proof-key.mjs";

const origin = "http://localhost:3100";
const token = "w".repeat(43);
const proofKey: PublicProofKey = {
  kty: "EC",
  crv: "P-256",
  x: "x".repeat(43),
  y: "y".repeat(43),
};

function sessionRequest(key?: PublicProofKey) {
  return new Request(`${origin}/api/auth/session`, {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: `__Secure-aihub_web_session=${token}${
        key ? `; ${proofKeyCookie(key).split(";")[0]}` : ""
      }`,
      "Content-Type": "application/json",
      "X-Real-IP": "198.51.100.10",
      "X-AIHUB-End-User-IP": "192.0.2.99",
    },
    body: "{}",
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const sessionToken of [
    token,
    "x".repeat(43),
    "o".repeat(43),
    "r".repeat(43),
    "p".repeat(43),
    "u".repeat(43),
    "v".repeat(43),
    "c".repeat(43),
    "d".repeat(43),
    "e".repeat(43),
  ])
    clearWebSessionCache(sessionToken);
  delete process.env.AIHUB_BASE_URL;
  delete process.env.AIHUB_WEB_SESSION_CLIENT_SECRET;
  delete process.env.CUSTOMER_WEB_ORIGIN;
});

describe("AIHUB Web Session BFF", () => {
  it("exchanges the HttpOnly cookie server-side and renews its browser lifetime", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = origin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    process.env.AIHUB_WEB_SESSION_CLIENT_SECRET = "server-only-secret";
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        data: {
          access_token: "jwt-server-only",
          expires_in: aihubLimits.webSessionAccessTokenMaxSeconds,
        },
      })
    );

    const response = await activity(sessionRequest());

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain(
      `__Secure-aihub_web_session=${token}; Path=/app; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict`
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3101/v1/auth/web-sessions/exchange",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "X-AIHUB-Client-Secret": "server-only-secret",
          "X-AIHUB-End-User-IP": "198.51.100.10",
        },
        body: JSON.stringify({ web_session_token: token }),
        cache: "no-store",
      })
    );
    expect(response.headers.get("set-cookie")).not.toContain("jwt-server-only");
  });

  it("clears a rejected session cookie on 401 and preserves it on 503", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = origin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    const expired = await activity(sessionRequest());
    const unavailable = await activity(
      new Request(`${origin}/api/auth/session`, {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: `__Secure-aihub_web_session=${"x".repeat(43)}`,
        },
      })
    );

    expect(expired.status).toBe(401);
    expect(expired.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get("set-cookie")).toBeNull();
  });

  it("uses the exchanged JWT only for the authenticated AIHUB request", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = origin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    process.env.AIHUB_WEB_SESSION_CLIENT_SECRET = "server-only-secret";
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        if (String(input).endsWith("/web-sessions/exchange"))
          return Response.json({
            data: {
              access_token: "jwt-server-only",
              expires_in: aihubLimits.webSessionAccessTokenMaxSeconds,
            },
          });
        expect(String(input)).toBe("http://127.0.0.1:3101/v1/organizations");
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer jwt-server-only"
        );
        return Response.json(
          { data: { organization_id: "org-1" } },
          { status: 201 }
        );
      });

    const response = await createOrganization(
      new Request(`${origin}/api/organizations`, {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: `__Secure-aihub_web_session=${"o".repeat(43)}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "9f6a9dd3-80d3-4f2b-a7bf-625a75d0a38a",
        },
        body: JSON.stringify({ name: "Test organization" }),
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      data: { organization_id: "org-1" },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("relays the browser proof key at exchange and caches the bound flag", async () => {
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    const boundToken = "p".repeat(43);
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

    const session = await getCurrentWebSession(boundToken, undefined, proofKey);

    expect(session?.dpopBound).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3101/v1/auth/web-sessions/exchange",
      expect.objectContaining({
        body: JSON.stringify({
          web_session_token: boundToken,
          client_proof_key: proofKey,
        }),
      })
    );
  });

  it("reads the proof key from the request cookie", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = origin;
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        data: {
          access_token: "jwt-cookie",
          token_type: "Bearer",
          expires_in: aihubLimits.webSessionAccessTokenMaxSeconds,
          dpop_bound: true,
        },
      })
    );

    const response = await activity(sessionRequest(proofKey));

    expect(response.status).toBe(204);
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3101/v1/auth/web-sessions/exchange",
      expect.objectContaining({
        body: JSON.stringify({
          web_session_token: token,
          client_proof_key: proofKey,
        }),
      })
    );
  });

  it("treats an exchange response without dpop_bound as unbound Bearer", async () => {
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    const unboundToken = "u".repeat(43);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        data: {
          access_token: "jwt-unbound",
          token_type: "Bearer",
          expires_in: aihubLimits.webSessionAccessTokenMaxSeconds,
        },
      })
    );

    const session = await getCurrentWebSession(
      unboundToken,
      undefined,
      proofKey
    );

    expect(session?.dpopBound).toBe(false);
  });

  it("retries unbound when an older AIHUB image rejects the proof key field", async () => {
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    const legacyToken = "v".repeat(43);
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 400 }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            access_token: "jwt-legacy",
            token_type: "Bearer",
            expires_in: aihubLimits.webSessionAccessTokenMaxSeconds,
          },
        })
      );

    const session = await getCurrentWebSession(
      legacyToken,
      undefined,
      proofKey
    );

    expect(session?.dpopBound).toBe(false);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:3101/v1/auth/web-sessions/exchange",
      expect.objectContaining({
        body: JSON.stringify({
          web_session_token: legacyToken,
          client_proof_key: proofKey,
        }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:3101/v1/auth/web-sessions/exchange",
      expect.objectContaining({
        body: JSON.stringify({ web_session_token: legacyToken }),
      })
    );
  });

  it("clears the browser cookie when a protected request and session exchange reject it", async () => {
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          data: {
            access_token: "jwt-server-only",
            expires_in: aihubLimits.webSessionAccessTokenMaxSeconds,
          },
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    const response = await authenticatedAihubFetch(
      new Request(`${origin}/api/organizations/me/members`, {
        headers: { "X-Real-IP": "198.51.100.10" },
      }),
      "r".repeat(43),
      "/v1/organizations/me/members"
    );

    expect(response.status).toBe(401);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:3101/v1/auth/web-sessions/exchange",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-AIHUB-End-User-IP": "198.51.100.10",
        }),
      })
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await response.json()).toEqual({
      success: false,
      error: { code: "AUTH_REQUIRED", message: "Sign-in required." },
    });
  });

  it("clears the cookie when the first exchange rejects the Web Session", async () => {
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 401 })
    );

    const response = await authenticatedAihubFetch(
      new Request(`${origin}/api/organizations/me/members`),
      "r".repeat(43),
      "/v1/organizations/me/members"
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  function makeProof(claims: { method: string; url: string; ath: string }) {
    const header = Buffer.from(
      JSON.stringify({
        typ: "dpop+jwt",
        alg: "ES256",
        jwk: { kty: "EC", crv: "P-256", x: "x".repeat(43), y: "y".repeat(43) },
      })
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        htm: claims.method,
        htu: claims.url,
        ath: claims.ath,
        jti: "unique-jti",
        iat: Math.floor(Date.now() / 1000),
      })
    ).toString("base64url");
    return `${header}.${payload}.signature`;
  }

  async function boundSession(sessionToken: string) {
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
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
    await getCurrentWebSession(sessionToken, undefined, proofKey);
    return fetch;
  }

  it("returns a DPoP challenge for a bound token without a proof", async () => {
    const sessionToken = "c".repeat(43);
    const fetch = await boundSession(sessionToken);
    fetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const response = await authenticatedAihubFetch(
      new Request(`${origin}/app/api/organizations`, {
        method: "GET",
        headers: { "Sec-Fetch-Site": "same-origin" },
      }),
      sessionToken,
      "/v1/organizations/me/members"
    );

    expect(response.status).toBe(428);
    expect(response.headers.get("X-AIHUB-DPOP-CHALLENGE")).toBeTruthy();
    expect((await response.json()).error.code).toBe("DPOP_PROOF_REQUIRED");
  });

  it("sends DPoP headers when a valid challenge and proof are supplied", async () => {
    const sessionToken = "d".repeat(43);
    const fetch = await boundSession(sessionToken);
    fetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const first = await authenticatedAihubFetch(
      new Request(`${origin}/app/api/organizations`, {
        method: "GET",
        headers: { "Sec-Fetch-Site": "same-origin" },
      }),
      sessionToken,
      "/v1/organizations/me/members"
    );
    const challenge = first.headers.get("X-AIHUB-DPOP-CHALLENGE")!;
    const ath = createHash("sha256").update("jwt-bound").digest("base64url");

    fetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const response = await authenticatedAihubFetch(
      new Request(`${origin}/app/api/organizations`, {
        method: "GET",
        headers: {
          "Sec-Fetch-Site": "same-origin",
          "X-DPoP-Challenge": challenge,
          "X-DPoP-Proof": makeProof({
            method: "GET",
            url: "http://127.0.0.1:3101/v1/organizations/me/members",
            ath,
          }),
        },
      }),
      sessionToken,
      "/v1/organizations/me/members"
    );

    expect(response.status).toBe(200);
    const upstreamInit = fetch.mock.calls.at(-1)?.[1];
    const headers = new Headers(upstreamInit?.headers);
    expect(headers.get("authorization")).toBe("DPoP jwt-bound");
    expect(headers.get("dpop")).toMatch(/\.signature$/);
  });

  it("issues a fresh challenge with the refreshed token's hash after a 401", async () => {
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    const sessionToken = "e".repeat(43);
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          data: {
            access_token: "jwt-bound-1",
            token_type: "Bearer",
            expires_in: aihubLimits.webSessionAccessTokenMaxSeconds,
            dpop_bound: true,
          },
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            access_token: "jwt-bound-2",
            token_type: "Bearer",
            expires_in: aihubLimits.webSessionAccessTokenMaxSeconds,
            dpop_bound: true,
          },
        })
      );
    await getCurrentWebSession(sessionToken, undefined, proofKey);
    const path = "/v1/organizations/me/members";
    const first = await authenticatedAihubFetch(
      new Request(`${origin}/app/api/organizations`, {
        method: "GET",
        headers: { "Sec-Fetch-Site": "same-origin" },
      }),
      sessionToken,
      path
    );
    const challenge = first.headers.get("X-AIHUB-DPOP-CHALLENGE")!;
    const response = await authenticatedAihubFetch(
      new Request(`${origin}/app/api/organizations`, {
        method: "GET",
        headers: {
          "Sec-Fetch-Site": "same-origin",
          "X-DPoP-Challenge": challenge,
          "X-DPoP-Proof": makeProof({
            method: "GET",
            url: "http://127.0.0.1:3101/v1/organizations/me/members",
            ath: createHash("sha256").update("jwt-bound-1").digest("base64url"),
          }),
        },
      }),
      sessionToken,
      path
    );

    expect(response.status).toBe(428);
    const refreshed = response.headers.get("X-AIHUB-DPOP-CHALLENGE")!;
    const payload = JSON.parse(
      Buffer.from(refreshed.split(".")[0], "base64url").toString("utf8")
    ) as { a: string };
    expect(payload.a).toBe(
      createHash("sha256").update("jwt-bound-2").digest("base64url")
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("keeps Bearer for unbound tokens", async () => {
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    const unboundToken = "u".repeat(43);
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        data: {
          access_token: "jwt-unbound",
          token_type: "Bearer",
          expires_in: aihubLimits.webSessionAccessTokenMaxSeconds,
        },
      })
    );
    await getCurrentWebSession(unboundToken, undefined);
    fetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await authenticatedAihubFetch(
      new Request(`${origin}/app/api/organizations`, {
        method: "GET",
        headers: { "Sec-Fetch-Site": "same-origin" },
      }),
      unboundToken,
      "/v1/organizations/me/members"
    );

    const headers = new Headers(fetch.mock.calls.at(-1)?.[1]?.headers);
    expect(headers.get("authorization")).toBe("Bearer jwt-unbound");
  });

  it("drops expired access tokens instead of keeping every abandoned session", async () => {
    process.env.AIHUB_BASE_URL = "http://127.0.0.1:3101";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2099-01-01T00:00:00Z"));
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({
        data: {
          access_token: "jwt",
          expires_in: aihubLimits.webSessionAccessTokenMaxSeconds,
        },
      })
    );
    try {
      const before = cachedWebSessionCount();
      await getCurrentWebSession("x".repeat(43), undefined);
      expect(cachedWebSessionCount()).toBe(before + 1);

      vi.setSystemTime(new Date("2099-01-01T00:16:00Z"));
      await getCurrentWebSession("o".repeat(43), undefined);

      expect(cachedWebSessionCount()).toBe(before + 1);
    } finally {
      vi.useRealTimers();
    }
  });
});
