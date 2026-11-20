import { describe, expect, it } from "vitest";
import {
  parsePublicProofKey,
  proofKeyFromCookieHeader,
  proofKeyCookie,
  type PublicProofKey,
} from "@/lib/public-proof-key.mjs";

const key: PublicProofKey = {
  kty: "EC",
  crv: "P-256",
  x: "x".repeat(43),
  y: "y".repeat(43),
};

describe("public proof key contract", () => {
  it("parses a proof key cookie and rejects invalid shapes", () => {
    expect(proofKeyFromCookieHeader(proofKeyCookie(key).split(";")[0])).toEqual(
      key
    );
    expect(parsePublicProofKey(JSON.stringify(key))).toEqual(key);
    expect(
      parsePublicProofKey(JSON.stringify({ ...key, x: "short" }))
    ).toBeNull();
    expect(parsePublicProofKey(JSON.stringify({ kty: "RSA" }))).toBeNull();
  });
});
