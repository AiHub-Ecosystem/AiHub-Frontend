import { describe, expect, it } from "vitest";
import {
  accessTokenHash,
  createDpopChallenge,
  decodeDpopChallenge,
  verifyDpopChallenge,
} from "@/lib/dpop-challenge";

const input = {
  sessionToken: "w".repeat(43),
  method: "POST",
  url: "http://127.0.0.1:3101/v1/organizations",
  accessToken: "jwt-bound",
};

describe("DPoP challenge", () => {
  it("round-trips a challenge bound to session, method, url and token hash", () => {
    process.env.AIHUB_WEB_SESSION_CLIENT_SECRET = "server-only-secret";
    const challenge = createDpopChallenge(input);
    const decoded = decodeDpopChallenge(challenge)!;

    expect(decoded).toMatchObject({
      v: 1,
      s: expect.any(String),
      m: "POST",
      u: input.url,
      a: accessTokenHash("jwt-bound"),
    });
    expect(decoded.e).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(verifyDpopChallenge(challenge, input)).toBe(true);
  });

  it("rejects tampering, expiry and descriptor mismatch", () => {
    process.env.AIHUB_WEB_SESSION_CLIENT_SECRET = "server-only-secret";
    const challenge = createDpopChallenge(input);
    const [body] = challenge.split(".");
    const tampered = Buffer.from(
      JSON.stringify({ ...decodeDpopChallenge(challenge), m: "GET" })
    ).toString("base64url");

    expect(verifyDpopChallenge(`${tampered}.bad`, input)).toBe(false);
    expect(verifyDpopChallenge(challenge, { ...input, method: "GET" })).toBe(
      false
    );
    expect(
      verifyDpopChallenge(challenge, { ...input, accessToken: "other" })
    ).toBe(false);
    expect(verifyDpopChallenge(`${body}.`, input)).toBe(false);
  });
});
