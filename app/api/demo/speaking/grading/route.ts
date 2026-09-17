import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { gradeSpeaking, SpeakingBoundaryError, type SpeakingErrorCode } from "@/lib/speaking-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const STATUS_BY_CODE: Record<SpeakingErrorCode, number> = {
  INVALID_REQUEST: 400,
  PAYLOAD_TOO_LARGE: 413,
  AI_SERVICE_ERROR: 502,
  AI_SERVICE_CONTRACT_VIOLATION: 502,
  AI_SERVICE_THROTTLED: 429,
  AI_SERVICE_UNAVAILABLE: 503,
  AI_SERVICE_TIMEOUT: 504,
};

const MESSAGE_BY_CODE: Record<SpeakingErrorCode, string> = {
  INVALID_REQUEST: "Check the audio and speaking prompt, then try again.",
  PAYLOAD_TOO_LARGE: "Audio must be 25 MB or smaller.",
  AI_SERVICE_ERROR: "The speaking service returned an error. Try again later.",
  AI_SERVICE_CONTRACT_VIOLATION: "The speaking service returned an unexpected response.",
  AI_SERVICE_THROTTLED: "The speaking service is busy. Try again shortly.",
  AI_SERVICE_UNAVAILABLE: "The speaking service is temporarily unavailable.",
  AI_SERVICE_TIMEOUT: "The speaking service took too long to respond.",
};

export async function POST(request: Request) {
  const requestId = `req_${randomUUID()}`;
  try {
    const payload = await gradeSpeaking(request, requestId);
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code: SpeakingErrorCode = error instanceof SpeakingBoundaryError ? error.code : "AI_SERVICE_UNAVAILABLE";
    return NextResponse.json(
      { error: { code, message: MESSAGE_BY_CODE[code] }, meta: { request_id: requestId, service: "speaking" } },
      { status: STATUS_BY_CODE[code], headers: { "Cache-Control": "no-store" } },
    );
  }
}
