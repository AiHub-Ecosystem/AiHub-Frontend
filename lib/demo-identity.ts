export type DemoIdentityMode = "declared_id" | "signed_assertion";

export const MAX_SIGNED_USER_ASSERTION_BYTES = 6 * 1024;

const NON_VISIBLE_ASCII = /[^\x21-\x7E]/;

export function isDemoIdentityMode(value: unknown): value is DemoIdentityMode {
  return value === "declared_id" || value === "signed_assertion";
}

/** The demo checks only safe header bytes and size; JWT validation belongs to AIHUB. */
export function isDemoUserIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_SIGNED_USER_ASSERTION_BYTES &&
    !NON_VISIBLE_ASCII.test(value)
  );
}
