const NON_VISIBLE_ASCII = /[^\x21-\x7E]/;

/** Matches AIHUB's end-user ID rule: visible ASCII characters, at most 256. */
export function isEndUserId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    !NON_VISIBLE_ASCII.test(value)
  );
}
