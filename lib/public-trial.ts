import { WRITING_TASK2_REQUEST } from "@/data/writing-task2-request";
import { API_KEY_RAW_FORMAT } from "@/lib/api-keys";

/**
 * The public trial key printed on the landing page (ADR-0023).
 *
 * It is a real Sandbox key, published on purpose so a developer, an AI agent
 * or a non-technical visitor can make a first call by copying one prompt. The
 * key is not a secret: what protects AIHUB is the backend, which caps the key
 * at TRIAL_DAILY_LIMIT dispatches per UTC day and TRIAL_PER_IP_DAILY_LIMIT per
 * caller IP. Neither figure is exposed by the API, so these constants are copy,
 * not configuration: if aihub-be changes them, this page is wrong until it is
 * redeployed, the same accepted drift ADR-0009 records for the Sandbox
 * allowance.
 */
export const TRIAL_DAILY_LIMIT = 100;
export const TRIAL_PER_IP_DAILY_LIMIT = 10;
export const TRIAL_HOST = "https://sandbox.aihubproduction.com";
export const TRIAL_GRADE_PATH = "/v1/ielts/writing/task2/grade";
export const TRIAL_GRADE_URL = `${TRIAL_HOST}${TRIAL_GRADE_PATH}`;

/** Shown wherever the key is missing, so copied text still says what to fill. */
export const TRIAL_KEY_PLACEHOLDER = "<AIHUB_TRIAL_KEY>";

/**
 * Reads the key from server env. Only a well-formed `aihub_sandbox_` key is
 * published: a Production key pasted into this variable by mistake would print
 * a paid credential on the home page, so it is refused rather than shown.
 */
export function readPublicTrialKey(
  value = process.env.AIHUB_PUBLIC_TRIAL_API_KEY
): string | null {
  const key = value?.trim() ?? "";
  if (!key.startsWith("aihub_sandbox_")) return null;
  return API_KEY_RAW_FORMAT.test(key) ? key : null;
}

/** A shell-safe single-quoted literal; the essay contains apostrophes. */
function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildTrialCurl(key: string | null) {
  const body = JSON.stringify(WRITING_TASK2_REQUEST);
  return [
    `curl -X POST ${TRIAL_GRADE_URL} \\`,
    `  -H ${shellQuote(`X-API-Key: ${key ?? TRIAL_KEY_PLACEHOLDER}`)} \\`,
    `  -H 'X-User-Identity: trial-learner-1' \\`,
    `  -H "Idempotency-Key: $(uuidgen)" \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d ${shellQuote(body)}`,
  ].join("\n");
}

/**
 * One prompt that works for whoever pastes it: an agent that can run commands
 * makes the call and summarises the grade; a chat that cannot hands back the
 * command instead. It tells the model to stop on 429 so a quota error is not
 * retried into the rest of the day's shared allowance.
 */
export function buildTrialPrompt(key: string | null, registerUrl: string) {
  const apiKey = key ?? TRIAL_KEY_PLACEHOLDER;
  return `Bạn là trợ lý tích hợp API. Hãy dùng AiHub API để chấm một bài IELTS Writing Task 2 cho tôi.

## Thông tin gọi API
- Endpoint: POST ${TRIAL_GRADE_URL}
- API key dùng thử (công khai, chỉ chạy trên Sandbox): ${apiKey}
- Giới hạn: ${TRIAL_DAILY_LIMIT} lượt/ngày dùng chung cho mọi người, tối đa ${TRIAL_PER_IP_DAILY_LIMIT} lượt/ngày cho mỗi địa chỉ IP, đặt lại lúc 00:00 UTC.
- Headers:
  - X-API-Key: ${apiKey}
  - X-User-Identity: mã người học, chuỗi ASCII bất kỳ, ví dụ "trial-learner-1"
  - Idempotency-Key: một UUID v4 mới cho mỗi bài (gửi lại cùng bài thì giữ nguyên UUID)
  - Content-Type: application/json
- Body JSON: { "question": string, "topic": string, "essay": string }
- Thời gian chấm có thể tới 60 giây; đặt timeout ít nhất 90 giây.
- Kết quả nằm trong "data": overall_band, và criteria là 4 tiêu chí, mỗi tiêu chí có name, band, band_reason, strengths, improvements.

## Việc cần làm
1. Nếu bạn chạy được lệnh hoặc gọi được HTTP: gửi đúng MỘT request với bài bên dưới (hoặc bài tôi gửi kèm), rồi tóm tắt bằng tiếng Việt: band tổng, band từng tiêu chí, 3 điểm cần sửa quan trọng nhất kèm câu viết lại.
2. Nếu bạn không gọi được mạng: đưa tôi lệnh cURL hoàn chỉnh để tôi tự chạy, rồi giải thích kết quả khi tôi dán lại.
3. Nếu nhận lỗi 429 (QUOTA_EXCEEDED hoặc RATE_LIMITED): KHÔNG thử lại. Báo tôi hạn mức dùng thử đã hết và tôi có thể tạo key riêng tại ${registerUrl}.
4. Nếu tôi muốn tích hợp vào sản phẩm: viết code mẫu (Node.js hoặc Python) đọc key từ biến môi trường AIHUB_API_KEY, không ghi cứng key vào code.

## Bài mẫu (dùng khi tôi không gửi bài riêng)
topic: ${WRITING_TASK2_REQUEST.topic}
question: ${WRITING_TASK2_REQUEST.question}
essay: ${WRITING_TASK2_REQUEST.essay}`;
}
