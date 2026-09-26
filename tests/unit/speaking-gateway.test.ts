import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSandboxBaseUrl,
  SpeakingBoundaryError,
} from "@/lib/speaking-gateway";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Speaking sandbox URL", () => {
  it("allows the explicitly configured loopback mock only in development", () => {
    const mockUrl = "http://127.0.0.1:3101";
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AIHUB_SANDBOX_BASE_URL", mockUrl);
    vi.stubEnv("AIHUB_SANDBOX_E2E_MOCK_BASE_URL", mockUrl);

    expect(getSandboxBaseUrl()).toBe(mockUrl);

    vi.stubEnv("NODE_ENV", "production");
    expect(() => getSandboxBaseUrl()).toThrow(SpeakingBoundaryError);

    const sandboxUrl = "https://sandbox.aihubproduction.com";
    vi.stubEnv("AIHUB_SANDBOX_BASE_URL", sandboxUrl);
    expect(getSandboxBaseUrl()).toBe(sandboxUrl);
  });

  it("rejects an unconfigured loopback target", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AIHUB_SANDBOX_BASE_URL", "http://127.0.0.1:3101");
    vi.stubEnv("AIHUB_SANDBOX_E2E_MOCK_BASE_URL", "http://127.0.0.1:3102");

    expect(() => getSandboxBaseUrl()).toThrow(SpeakingBoundaryError);
  });
});
