import { DPOP_INVALID_CODE, DPOP_REQUIRED_CODE } from "@/lib/dpop-challenge";

/** Pass DPoP challenge/error responses through with their headers intact. */
export async function dpopHandshakeResponse(response: Response) {
  if (response.status !== 428 && response.status !== 400) return null;
  try {
    const body = (await response.clone().json()) as {
      error?: { code?: unknown };
    };
    const code = body.error?.code;
    if (code !== DPOP_REQUIRED_CODE && code !== DPOP_INVALID_CODE) return null;
  } catch {
    return null;
  }
  return response;
}
