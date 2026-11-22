import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(
  fileURLToPath(
    new URL("../../apps/landing/public/meltano-source.css", import.meta.url)
  ),
  "utf8"
);

describe("landing hero em styling", () => {
  it("does not decorate the hero AiHub emphasis with slashes", () => {
    expect(CSS).toMatch(
      /\.hero-title em::?(before|after)[\s\S]*?content:\s*"";/
    );
  });
});
