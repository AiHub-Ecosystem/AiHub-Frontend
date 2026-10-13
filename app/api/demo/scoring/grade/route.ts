import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  gradeWriting,
  ScoringBoundaryError,
  ScoringUpstreamError,
  type WritingErrorCode,
} from "@/lib/scoring-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The client budget is at least 90s so the 60s server budget is ours to hit
// rather than the transport's.
export const maxDuration = 90;

const STATUS_BY_CODE: Record<WritingErrorCode, number> = {
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

/**
 * The upstream message is free text that may describe internals, so it is
 * replaced. The code is not: `QUOTA_EXCEEDED` carrying a day-long retry hint
 * reported as "service is busy" would be simply false.
 */
const MESSAGE_BY_CODE: Record<WritingErrorCode, string> = {
  INVALID_REQUEST:
    "Bài gửi lên không hợp lệ. Kiểm tra lại các trường rồi thử lại.",
  PAYLOAD_TOO_LARGE: "Nội dung gửi lên vượt quá 256 KB. Rút ngắn bài làm.",
  UNAUTHORIZED: "API key không hợp lệ hoặc đã bị thu hồi.",
  INVALID_USER_IDENTITY: "Phiên demo không hợp lệ. Tải lại trang rồi thử lại.",
  AI_SERVICE_ERROR: "Dịch vụ chấm bài trả về lỗi. Thử lại sau.",
  AI_SERVICE_CONTRACT_VIOLATION:
    "Dịch vụ chấm bài trả về kết quả không đúng định dạng.",
  AI_SERVICE_THROTTLED: "Dịch vụ chấm bài đang giới hạn. Lùi rồi thử lại.",
  AI_SERVICE_UNAVAILABLE:
    "Dịch vụ chấm bài tạm thời không truy cập được. Thử lại sau.",
  AI_SERVICE_TIMEOUT:
    "Chấm bài mất quá lâu. Bấm lại nút chấm để thử lại bằng một lần chấm mới.",
};

/**
 * The codes the public demo exposes as ordinary visitor outcomes rather than
 * infrastructure faults.
 */
const UPSTREAM_MESSAGES: Record<string, string> = {
  RATE_LIMITED:
    "Bạn gửi hơi nhanh. Chờ một chút rồi bấm lại — mỗi lần bấm là một lần chấm.",
  CONCURRENCY_LIMIT: "AIHUB đang xử lý một bài khác. Chờ xong rồi thử lại.",
  QUOTA_EXCEEDED:
    "Demo đã hết hạn mức chấm trong tháng. Hạn mức hồi lại lúc 00:00 UTC ngày 1 tháng sau.",
  FORBIDDEN:
    "API key thiếu scope writing.grade hoặc Organization đang bật Identity Configuration.",
  UNAUTHORIZED: "API key không hợp lệ hoặc đã hết hạn.",
  ENVIRONMENT_NOT_ALLOWED: "Key không được phép cho môi trường demo đã chọn.",
  USER_IDENTITY_REQUIRED:
    "Thiếu User Identity. Demo luôn gửi kèm, nên lỗi này chỉ xảy ra khi cấu hình phía AIHUB có vấn đề.",
  INVALID_USER_IDENTITY:
    "Organization đang bật Identity Configuration hoặc User Identity của phiên demo không hợp lệ.",
  IDEMPOTENCY_CONFLICT:
    "Idempotency-Key này đã được dùng cho nội dung khác. Hãy sửa bài để tạo lượt gửi mới.",
  AI_SERVICE_THROTTLED: "Dịch vụ chấm bên dưới đang giới hạn. Lùi rồi bấm lại.",
  AI_SERVICE_TIMEOUT:
    "Chấm bài vượt ngân sách 60 giây. Bấm lại nút chấm để thử lại.",
  AI_SERVICE_UNAVAILABLE: "Không tới được dịch vụ chấm. Thử lại sau.",
  AI_SERVICE_ERROR: "Dịch vụ chấm bài trả về lỗi. Thử lại sau.",
  INTERNAL_ERROR:
    "Lỗi phía AIHUB. Bấm lại nút chấm; nếu vẫn lỗi, báo lại kèm request_id.",
};

function noStore(json: unknown, status: number) {
  return NextResponse.json(json, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const requestId = `req_${randomUUID()}`;
  try {
    const payload = await gradeWriting(request, requestId);
    return noStore(payload, 200);
  } catch (error) {
    if (error instanceof ScoringUpstreamError) {
      const { code, status, retryable, retry_after_ms } = error;
      return noStore(
        {
          error: {
            code,
            message: UPSTREAM_MESSAGES[code] ?? "Yêu cầu bị AIHUB từ chối.",
            retryable,
            ...(retry_after_ms === undefined ? {} : { retry_after_ms }),
          },
          meta: { request_id: requestId, service: "writing" },
        },
        status
      );
    }

    const code: WritingErrorCode =
      error instanceof ScoringBoundaryError
        ? error.code
        : "AI_SERVICE_UNAVAILABLE";
    return noStore(
      {
        error: { code, message: MESSAGE_BY_CODE[code] },
        meta: { request_id: requestId, service: "writing" },
      },
      STATUS_BY_CODE[code]
    );
  }
}
