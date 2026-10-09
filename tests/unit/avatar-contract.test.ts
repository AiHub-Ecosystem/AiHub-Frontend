import { describe, expect, it } from "vitest";
import { isAvatar, isAvatarAssetId, type Avatar } from "@/lib/avatar-contract";

const avatar: Avatar = {
  asset_id: "ava_01ARZ3NDEKTSV4RRFFQ69G5FAV",
  content_type: "image/png",
  byte_size: 128,
  accepted_at: "2026-01-01T00:00:00.000Z",
  url: "https://s3.wispace.app/avatar.webp",
};

describe("Avatar contract", () => {
  it("accepts ULID asset identifiers and rejects malformed values", () => {
    expect(isAvatarAssetId(avatar.asset_id)).toBe(true);
    expect(isAvatarAssetId("ava_01ARZ3NDEKTSV4RRFFQ69G5FAI")).toBe(false);
    expect(isAvatarAssetId("ava_short")).toBe(false);
    expect(isAvatarAssetId(null)).toBe(false);
  });

  it("accepts the public Avatar shape and absence", () => {
    expect(isAvatar(avatar)).toBe(true);
    expect(isAvatar(null)).toBe(true);
  });

  it.each([
    { ...avatar, content_type: "image/gif" },
    { ...avatar, byte_size: 2 * 1024 * 1024 + 1 },
    { ...avatar, accepted_at: "not-a-date" },
    { ...avatar, url: "https://attacker.example/avatar.webp" },
  ])("rejects an invalid Avatar shape", (value) => {
    expect(isAvatar(value)).toBe(false);
  });
});
