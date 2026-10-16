import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DemoBoundaryError,
  DemoCredentialError,
  demoBffHeaders,
  readDemoUserIdentity,
  resolveDemoBaseUrl,
} from "@/lib/demo-gateway";

const sandboxHost = "sandbox.aihubproduction.com";
const productionHost = "api.aihubproduction.com";
const mockUrl = "http://127.0.0.1:3101";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("The pinned host per environment", () => {
  it("routes Sandbox to the Sandbox host and Production to the Production host", () => {
    vi.stubEnv("AIHUB_SANDBOX_BASE_URL", `https://${sandboxHost}`);
    vi.stubEnv("AIHUB_PRODUCTION_BASE_URL", `https://${productionHost}`);

    expect(resolveDemoBaseUrl("sandbox")).toBe(`https://${sandboxHost}`);
    expect(resolveDemoBaseUrl("production")).toBe(`https://${productionHost}`);
  });

  it("refuses to send a request to the host of the other environment", () => {
    vi.stubEnv("AIHUB_SANDBOX_BASE_URL", `https://${productionHost}`);
    vi.stubEnv("AIHUB_PRODUCTION_BASE_URL", `https://${productionHost}`);

    expect(() => resolveDemoBaseUrl("sandbox")).toThrow(DemoBoundaryError);
  });

  it("refuses an environment it has no base URL for", () => {
    vi.stubEnv("AIHUB_SANDBOX_BASE_URL", `https://${sandboxHost}`);
    vi.stubEnv("AIHUB_PRODUCTION_BASE_URL", undefined);

    expect(() => resolveDemoBaseUrl("production")).toThrow(DemoBoundaryError);
  });

  it("refuses a host that is not the pinned HTTPS one", () => {
    vi.stubEnv("AIHUB_SANDBOX_BASE_URL", "https://sandbox.example.test");

    expect(() => resolveDemoBaseUrl("sandbox")).toThrow(DemoBoundaryError);
  });

  it("refuses plaintext HTTP outside the local development mock", () => {
    vi.stubEnv("AIHUB_SANDBOX_BASE_URL", `http://${sandboxHost}`);
    vi.stubEnv("AIHUB_PRODUCTION_BASE_URL", `https://${productionHost}`);

    expect(() => resolveDemoBaseUrl("sandbox")).toThrow(DemoBoundaryError);
  });

  it("accepts the configured local mock for each environment in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AIHUB_SANDBOX_BASE_URL", mockUrl);
    vi.stubEnv("AIHUB_SANDBOX_E2E_MOCK_BASE_URL", mockUrl);
    vi.stubEnv("AIHUB_PRODUCTION_BASE_URL", mockUrl);
    vi.stubEnv("AIHUB_PRODUCTION_E2E_MOCK_BASE_URL", mockUrl);

    expect(resolveDemoBaseUrl("sandbox")).toBe(mockUrl);
    expect(resolveDemoBaseUrl("production")).toBe(mockUrl);
  });
});

describe("server-to-server demo headers", () => {
  it("uses the rightmost trusted proxy address and the server-only secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AIHUB_WEB_SESSION_CLIENT_SECRET", "server-only-secret");
    const request = new Request("https://customer.test/api/demo", {
      headers: {
        "x-forwarded-for": "203.0.113.7, 198.51.100.25",
      },
    });

    expect(demoBffHeaders(request)).toEqual({
      "X-AIHUB-Client-Secret": "server-only-secret",
      "X-AIHUB-Visitor-IP": "198.51.100.25",
    });
  });

  it("fails closed in production when the trusted ingress IP or BFF secret is absent", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AIHUB_WEB_SESSION_CLIENT_SECRET", "server-only-secret");
    expect(() => demoBffHeaders(new Request("https://customer.test"))).toThrow(
      DemoBoundaryError
    );

    vi.stubEnv("AIHUB_WEB_SESSION_CLIENT_SECRET", undefined);
    expect(() =>
      demoBffHeaders(
        new Request("https://customer.test", {
          headers: { "x-forwarded-for": "198.51.100.25" },
        })
      )
    ).toThrow(DemoBoundaryError);
  });

  it("uses loopback only for local requests without forwarded client IP", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      demoBffHeaders(new Request("http://localhost:3100/api/demo"))
    ).toEqual({ "X-AIHUB-Visitor-IP": "127.0.0.1" });
  });
});

describe("demo user identity", () => {
  it("accepts the end-user ID format supported by AIHUB", () => {
    expect(
      readDemoUserIdentity(
        new Request("https://customer.test/api/demo", {
          headers: { "X-Demo-User-Identity": "customer_42" },
        })
      )
    ).toBe("customer_42");
    expect(
      readDemoUserIdentity(
        new Request("https://customer.test/api/demo", {
          headers: { "X-Demo-User-Identity": "x".repeat(6 * 1024) },
        })
      )
    ).toHaveLength(6 * 1024);
  });

  it("rejects values the AIHUB identity contract cannot accept", () => {
    for (const value of ["", "two words", "é", "x".repeat(6 * 1024 + 1)]) {
      expect(() =>
        readDemoUserIdentity(
          new Request("https://customer.test/api/demo", {
            headers: { "X-Demo-User-Identity": value },
          })
        )
      ).toThrow(DemoCredentialError);
    }
  });
});
