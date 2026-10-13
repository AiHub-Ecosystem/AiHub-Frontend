import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  gradeSpeakingByUrl,
  SpeakingBoundaryError,
  SpeakingUpstreamError,
  type SpeakingErrorCode,
} from "@/lib/speaking-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const STATUS_BY_CODE: Record<SpeakingErrorCode, number> = {
  INVALID_REQUEST: 400,
  PAYLOAD_TOO_LARGE: 413,
  UNAUTHORIZED: 401,
  INVALID_USER_IDENTITY: 400,
  AI_SERVICE_ERROR: 502,
  AI_SERVICE_CONTRACT_VIOLATION: 502,
  AI_SERVICE_THROTTLED: 429,
  AI_SERVICE_UNAVAILABLE: 503,
  AI_SERVICE_TIMEOUT: 504,
};

const MESSAGE_BY_CODE: Record<SpeakingErrorCode, string> = {
  INVALID_REQUEST: "Kiểm tra audio và đề Speaking rồi thử lại.",
  PAYLOAD_TOO_LARGE: "Audio cần nhỏ hơn hoặc bằng 25 MB.",
  UNAUTHORIZED: "API key không hợp lệ hoặc đã bị thu hồi.",
  INVALID_USER_IDENTITY:
    "Organization đang bật Identity Configuration hoặc phiên demo không hợp lệ.",
  AI_SERVICE_ERROR: "Dịch vụ chấm Speaking trả về lỗi. Thử lại sau.",
  AI_SERVICE_CONTRACT_VIOLATION:
    "Dịch vụ chấm Speaking trả về response không đúng định dạng.",
  AI_SERVICE_THROTTLED:
    "Dịch vụ Speaking đang giới hạn. Chờ một chút rồi thử lại.",
  AI_SERVICE_UNAVAILABLE: "Dịch vụ chấm Speaking tạm thời không truy cập được.",
  AI_SERVICE_TIMEOUT: "Chấm Speaking mất quá lâu. Thử lại sau.",
};

const UPSTREAM_MESSAGES: Record<string, string> = {
  FORBIDDEN:
    "API key thiếu scope speaking.grade hoặc Organization đang bật Identity Configuration.",
  ENVIRONMENT_NOT_ALLOWED: "Key không được phép cho môi trường demo đã chọn.",
  USER_IDENTITY_REQUIRED: "Thiếu User Identity của phiên demo.",
  RATE_LIMITED: "Bạn gửi hơi nhanh. Chờ một chút rồi thử lại.",
  CONCURRENCY_LIMIT: "AIHUB đang xử lý một bài khác. Chờ xong rồi thử lại.",
  QUOTA_EXCEEDED: "Môi trường đã hết hạn mức chấm trong tháng.",
  AI_SERVICE_TIMEOUT: "Chấm Speaking vượt thời gian cho phép. Thử lại sau.",
  AI_SERVICE_UNAVAILABLE: "Dịch vụ chấm Speaking tạm thời không truy cập được.",
};

function noStore(payload: unknown, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const requestId = `req_${randomUUID()}`;
  try {
    const payload = await gradeSpeakingByUrl(request, requestId);
    return noStore(payload, 200);
  } catch (error) {
    if (error instanceof SpeakingUpstreamError) {
      return noStore(
        {
          error: {
            code: error.code,
            message:
              UPSTREAM_MESSAGES[error.code] ?? "Yêu cầu bị AIHUB từ chối.",
            retryable: error.retryable,
            ...(error.retry_after_ms === undefined
              ? {}
              : { retry_after_ms: error.retry_after_ms }),
          },
          meta: { request_id: requestId, service: "speaking" },
        },
        error.status
      );
    }
    const code: SpeakingErrorCode =
      error instanceof SpeakingBoundaryError
        ? error.code
        : "AI_SERVICE_UNAVAILABLE";
    return noStore(
      {
        error: { code, message: MESSAGE_BY_CODE[code] },
        meta: { request_id: requestId, service: "speaking" },
      },
      STATUS_BY_CODE[code]
    );
  }
}
