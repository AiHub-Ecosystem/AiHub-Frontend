export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const AVATAR_STORAGE_ORIGIN = "https://s3.wispace.app";

export type Avatar = {
  asset_id: string;
  content_type: (typeof AVATAR_CONTENT_TYPES)[number];
  byte_size: number;
  accepted_at: string;
  url: string;
};

export function isAvatar(value: unknown): value is Avatar | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const avatar = value as Partial<Avatar>;
  let url: URL;
  try {
    url = new URL(String(avatar.url));
  } catch {
    return false;
  }
  return (
    typeof avatar.asset_id === "string" &&
    /^ava_[0-9A-HJKMNP-TV-Z]{26}$/.test(avatar.asset_id) &&
    typeof avatar.content_type === "string" &&
    AVATAR_CONTENT_TYPES.includes(
      avatar.content_type as (typeof AVATAR_CONTENT_TYPES)[number]
    ) &&
    typeof avatar.byte_size === "number" &&
    Number.isInteger(avatar.byte_size) &&
    avatar.byte_size > 0 &&
    avatar.byte_size <= AVATAR_MAX_BYTES &&
    typeof avatar.accepted_at === "string" &&
    Number.isFinite(Date.parse(avatar.accepted_at)) &&
    url.origin === AVATAR_STORAGE_ORIGIN
  );
}
