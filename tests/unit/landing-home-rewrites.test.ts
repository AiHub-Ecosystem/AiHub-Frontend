import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rewriteHomeBody } from "../../apps/landing/lib/home-rewrites";

const HOME_HTML = readFileSync(
  fileURLToPath(new URL("../../apps/landing/data/home.html", import.meta.url)),
  "utf8"
);

const REWRITTEN = rewriteHomeBody(HOME_HTML);

describe("landing home rewrites", () => {
  it("replaces the pretty-printed hero with AIHub copy", () => {
    expect(REWRITTEN).toContain("Hệ sinh thái API AI");
    expect(REWRITTEN).not.toContain("Dependable data by");
    expect(REWRITTEN).not.toContain("Meltano is an ETL platform");
    expect(REWRITTEN).toContain("Khám phá giải pháp");
  });

  it("removes the Meltano OPEN portal from the hero", () => {
    expect(REWRITTEN).not.toContain("portal-top portal-meltano");
  });

  it("replaces the pretty-printed closing CTA", () => {
    expect(REWRITTEN).toContain("Sẵn sàng");
    expect(REWRITTEN).not.toContain("Intrigued");
    expect(REWRITTEN).not.toContain("You haven’t seen nothing yet!");
  });
});
