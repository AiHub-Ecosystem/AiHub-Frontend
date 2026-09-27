import { describe, expect, it } from "vitest";
import { API_CATEGORIES } from "@/data/api-products";

/** AIHUB phục vụ các endpoint công khai dưới tiền tố này; provider khác có tiền tố riêng. */
const AIHUB_SERVED_SLUGS = ["scoring", "speaking"];

function endpointsFor(slug: string) {
  return API_CATEGORIES.flatMap((category) =>
    category.products
      .filter((product) => product.slug === slug)
      .flatMap((product) => product.endpoints)
  );
}

describe("API catalog paths", () => {
  it.each(AIHUB_SERVED_SLUGS)(
    "publishes %s endpoints under the public /v1/ielts/ prefix",
    (slug) => {
      const endpoints = endpointsFor(slug);
      expect(endpoints.length).toBeGreaterThan(0);
      for (const endpoint of endpoints) {
        expect(endpoint.path).toMatch(/^\/v1\/ielts\//);
      }
    }
  );

  it("publishes a Speaking questions path the demo route actually calls", () => {
    expect(endpointsFor("speaking").map((endpoint) => endpoint.path)).toContain(
      "/v1/ielts/speaking/questions?part={part}"
    );
  });
});
