import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { WRITING_TASK2_REQUEST } from "@/data/writing-task2-request";
import {
  buildTrialCurl,
  buildTrialPrompt,
  readPublicTrialKey,
  TRIAL_DAILY_LIMIT,
  TRIAL_GRADE_URL,
  TRIAL_KEY_PLACEHOLDER,
  TRIAL_PER_IP_DAILY_LIMIT,
} from "@/lib/public-trial";

const SANDBOX_KEY = `aihub_sandbox_${"a".repeat(43)}`;

describe("readPublicTrialKey", () => {
  it("publishes a well-formed Sandbox key", () => {
    expect(readPublicTrialKey(`  ${SANDBOX_KEY}\n`)).toBe(SANDBOX_KEY);
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["a Production key", `aihub_prod_${"a".repeat(43)}`],
    ["a dual-environment key", `aihub_sk_${"a".repeat(43)}`],
    ["a malformed Sandbox key", "aihub_sandbox_short"],
  ])("refuses %s", (_, value) => {
    expect(readPublicTrialKey(value)).toBeNull();
  });
});

describe("buildTrialPrompt", () => {
  const prompt = buildTrialPrompt(SANDBOX_KEY, "https://aihub.test/register");

  it("carries everything an agent needs for one call", () => {
    expect(prompt).toContain(`POST ${TRIAL_GRADE_URL}`);
    expect(prompt).toContain(`X-API-Key: ${SANDBOX_KEY}`);
    expect(prompt).toContain("X-User-Identity");
    expect(prompt).toContain("Idempotency-Key");
    expect(prompt).toContain(WRITING_TASK2_REQUEST.essay);
  });

  it("states the shared caps and stops on 429", () => {
    expect(prompt).toContain(`${TRIAL_DAILY_LIMIT} lượt/ngày`);
    expect(prompt).toContain(`${TRIAL_PER_IP_DAILY_LIMIT} lượt/ngày`);
    expect(prompt).toMatch(/429[^\n]*KHÔNG thử lại/);
    expect(prompt).toContain("https://aihub.test/register");
  });

  it("asks for integration code that reads the key from env", () => {
    expect(prompt).toContain("AIHUB_API_KEY");
  });

  it("falls back to a placeholder without a key", () => {
    const fallback = buildTrialPrompt(null, "x");
    expect(fallback).toContain(TRIAL_KEY_PLACEHOLDER);
    expect(fallback).not.toContain("aihub_sandbox_");
  });
});

describe("buildTrialCurl", () => {
  it("is a command bash parses back into the exact body", () => {
    const curl = buildTrialCurl(SANDBOX_KEY);
    // Replace curl with printf so the shell reports the arguments it parsed.
    const script = `uuidgen() { echo fixed; }\nset -- ${curl.replace(/^curl /, "")}\nfor a; do printf '%s\\0' "$a"; done`;
    const args = execFileSync("bash", ["-c", script], { encoding: "utf8" })
      .split("\0")
      .filter(Boolean);
    expect(args).toContain(`X-API-Key: ${SANDBOX_KEY}`);
    expect(args).toContain("Idempotency-Key: fixed");
    expect(JSON.parse(args[args.indexOf("-d") + 1])).toEqual(
      WRITING_TASK2_REQUEST
    );
  });
});
