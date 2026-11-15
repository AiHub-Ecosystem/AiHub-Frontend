import policy from "./error-code-policy.json";

export const AIHUB_ERROR_MESSAGES: Record<string, string> = policy.messages;
export const AIHUB_SAFE_GENERIC_ERROR_CODES = new Set<string>(
  policy.safeGenericCodes
);
export const AIHUB_GENERIC_ERROR_MESSAGE = "Yêu cầu bị AIHUB từ chối.";

export function aihubErrorMessage(code: string): string {
  return AIHUB_ERROR_MESSAGES[code] ?? AIHUB_GENERIC_ERROR_MESSAGE;
}
