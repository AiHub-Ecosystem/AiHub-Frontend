import {
  createWebSession,
  extractRefreshToken,
  logoutFromAihubBestEffort,
} from "@/lib/auth-session";

export async function createWebSessionFromAihubResponse(response: Response) {
  const refreshToken = extractRefreshToken(response.headers);
  try {
    const body = (await response.json()) as {
      data?: { access_token?: unknown; expires_in?: unknown };
    };
    if (
      typeof body.data?.access_token !== "string" ||
      !body.data.access_token ||
      typeof body.data.expires_in !== "number" ||
      !Number.isFinite(body.data.expires_in) ||
      body.data.expires_in <= 0 ||
      body.data.expires_in > 900 ||
      !refreshToken
    ) {
      throw new Error("AIHUB returned an invalid authentication response");
    }

    const sessionId = await createWebSession({
      accessToken: body.data.access_token,
      accessTokenExpiresAt: Date.now() + body.data.expires_in * 1000,
      refreshToken,
    });
    return { sessionId, refreshToken };
  } catch (error) {
    if (refreshToken) await logoutFromAihubBestEffort(refreshToken);
    throw error;
  }
}
