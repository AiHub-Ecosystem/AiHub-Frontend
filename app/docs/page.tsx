import type { Metadata } from "next";
import Link from "next/link";
import "../aihub.css";

export const metadata: Metadata = {
  title: "Hướng dẫn tích hợp — AIHub",
  description:
    "Từng bước đưa AIHUB vào hệ thống của bạn: tạo Organization, cấp API key, gọi thử và xử lý lỗi.",
};

const PRODUCTION_HOST = "https://api.aihubproduction.com";

const FIRST_CALL = `# 1. Lưu key vào biến môi trường (chỉ trong terminal, không commit)
export API_KEY="aihub_sk_..."

# 2. Định danh người dùng cuối — 1–256 ký tự ASCII, không khoảng trắng
export AIHUB_USER_IDENTITY="student_456"

# 3. Gọi thử một lần chấm Task 2
curl -X POST '${PRODUCTION_HOST}/v1/ielts/writing/task2/grade' \\
  -H "X-API-Key: $API_KEY" \\
  -H "X-User-Identity: $AIHUB_USER_IDENTITY" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{
    "topic": "education",
    "question": "Some people believe that universities should only offer academic subjects, while others think vocational training is equally important. Discuss both views and give your own opinion.",
    "essay": "Universities have traditionally focused on academic subjects, yet the value of vocational training is increasingly recognised..."
  }'`;

const NODE_SAMPLE = `// backend/grading.js — gọi AIHUB từ server, không bao giờ từ trình duyệt
import { randomUUID } from "node:crypto";

const AIHUB_HOST = "${PRODUCTION_HOST}";

export async function gradeTask2({ question, topic, essay, endUserId }) {
  const response = await fetch(\`\${AIHUB_HOST}/v1/ielts/writing/task2/grade\`, {
    method: "POST",
    signal: AbortSignal.timeout(90_000), // chấm Writing có thể mất tới 60 giây
    headers: {
      "X-API-Key": process.env.AIHUB_API_KEY,
      "X-User-Identity": endUserId,
      // Giữ nguyên key này khi retry, đừng sinh key mới cho cùng một bài làm.
      "Idempotency-Key": randomUUID(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question, topic, essay }),
  });

  if (response.status === 429) {
    const { error } = await response.json();
    const waitMs = error.retry_after_ms ?? 1000;
    throw Object.assign(new Error("AIHUB bận"), { retryAfterMs: waitMs });
  }
  if (!response.ok) throw new Error(\`AIHUB trả \${response.status}\`);

  // Mọi response thành công đều bọc trong { data, meta }.
  return (await response.json()).data;
}`;

const ERRORS = [
  {
    status: "400",
    code: "INVALID_REQUEST",
    cause:
      "Thiếu trường bắt buộc, sai kiểu, hoặc gửi thừa trường không thuộc hợp đồng (ví dụ gửi image_url cho Task 2).",
  },
  {
    status: "401",
    code: "UNAUTHORIZED",
    cause: "API key sai, đã thu hồi, hoặc đã hết hạn.",
  },
  {
    status: "401",
    code: "INVALID_USER_IDENTITY",
    cause:
      "Thiếu X-User-Identity trên endpoint user-scoped, hoặc giá trị vi phạm quy tắc 1–256 ký tự ASCII không khoảng trắng.",
  },
  {
    status: "403",
    code: "FORBIDDEN",
    cause:
      "Key thiếu scope cần cho endpoint, ví dụ gọi chấm Writing bằng key chỉ có speaking.grade.",
  },
  {
    status: "403",
    code: "ENVIRONMENT_NOT_ALLOWED",
    cause: "Gọi sai hostname so với Environment mà key cho phép.",
  },
  {
    status: "409",
    code: "IDEMPOTENCY_CONFLICT",
    cause:
      "Dùng lại Idempotency-Key cũ nhưng đổi nội dung body. Đổi body thì phải lấy key mới.",
  },
  {
    status: "429",
    code: "RATE_LIMITED",
    cause: "Vượt giới hạn tần suất. Tôn trọng retry_after_ms rồi thử lại.",
  },
  {
    status: "429",
    code: "QUOTA_EXCEEDED",
    cause: "Hết hạn mức dùng của Organization trong kỳ thanh toán.",
  },
];

export default function Page() {
  return (
    <div className="aihub">
      <div className="aihub-shell">
        <p className="aihub-eyebrow">Hướng dẫn</p>
        <h1 className="aihub-title">Tích hợp AIHUB</h1>
        <p className="aihub-lede">
          Tám bước từ tài khoản rỗng đến lệnh gọi đầu tiên. Làm theo thứ tự —
          mỗi bước độc lập với bước sau.
        </p>

        <section className="aihub-category">
          <div className="aihub-category-head">
            <h2 className="aihub-category-name">Trước khi bắt đầu</h2>
          </div>
          <ul className="aihub-facts">
            <li>
              <span className="aihub-facts-label">Base URL (production)</span>
              <span className="aihub-facts-value">{PRODUCTION_HOST}</span>
            </li>
            <li>
              <span className="aihub-facts-label">Xác thực</span>
              <span className="aihub-facts-value">Header X-API-Key</span>
            </li>
            <li>
              <span className="aihub-facts-label">Định dạng</span>
              <span className="aihub-facts-value">application/json</span>
            </li>
          </ul>
          <p className="aihub-callout" style={{ marginTop: 16 }}>
            API key phải được gọi từ server của bạn. Đưa key xuống trình duyệt
            hoặc mobile app là mất key.
          </p>
        </section>

        <section className="aihub-category">
          <div className="aihub-category-head">
            <h2 className="aihub-category-name">Các bước</h2>
            <p className="aihub-category-desc">
              Bước 3 là bước duy nhất không thể làm lại — raw key chỉ hiện một
              lần.
            </p>
          </div>
          <ol className="aihub-steps">
            <li>
              <h3>Tạo User Account và xác minh email</h3>
              <p>
                <Link href="/register">Đăng ký</Link> bằng email, username và
                mật khẩu, rồi mở email lấy link xác minh. Tài khoản chưa xác
                minh thì không đăng nhập được. Quên mật khẩu thì dùng{" "}
                <Link href="/forgot-password">khôi phục mật khẩu</Link>.
              </p>
            </li>
            <li>
              <h3>Tạo Organization</h3>
              <p>
                Organization là nơi sống của API key và cấu hình nhận diện. Tạo
                một Organization ở <Link href="/console/orgs">Console</Link>.
                Mỗi User Account chỉ tự tạo tối đa ba Organization trong suốt
                thời gian dùng; cần thêm thì liên hệ AIHUB.
              </p>
            </li>
            <li>
              <h3>Cấp API key và lưu ngay</h3>
              <p>
                Vào trang API keys của Organization, bấm{" "}
                <strong>Tạo API key</strong>, đặt tên và tick đúng các scope cần
                dùng: <code>writing.grade</code> cho chấm bài,{" "}
                <code>speaking.grade</code> cho chấm Speaking. Scope chưa được
                bật cho Organization sẽ bị khoá — liên hệ AIHUB để mở.
                <br />
                <strong>Raw key hiện đúng một lần</strong>, ngay sau khi tạo (và
                mỗi lần xoay vòng). Không lấy lại được lần hai. Lưu vào secret
                manager rồi đóng dialog.
              </p>
            </li>
            <li>
              <h3>Gọi thử một lần</h3>
              <p>
                Chạy lệnh dưới đây từ máy có mạng. Nếu trả về JSON cùng{" "}
                <code>data</code> và <code>meta</code> thì key đã hoạt động.
              </p>
              <pre className="aihub-code" style={{ marginTop: 12 }}>
                {FIRST_CALL}
              </pre>
            </li>
            <li>
              <h3>Gắn API vào backend</h3>
              <p>
                Chuyển lệnh curl thành code thật. Ba điểm dễ sai nhất: timeout
                trên 90 giây vì chấm Writing có thể mất tới 60 giây, sinh{" "}
                <code>Idempotency-Key</code> một lần cho mỗi bài làm, và bọc key
                trong biến môi trường chứ không hard-code.
              </p>
              <pre className="aihub-code" style={{ marginTop: 12 }}>
                {NODE_SAMPLE}
              </pre>
            </li>
            <li>
              <h3>Xử lý lỗi và retry</h3>
              <p>
                Mọi response thành công bọc trong{" "}
                <code>{"{ data, meta }"}</code> — đọc kết quả ở{" "}
                <code>data</code>, và giữ <code>meta.request_id</code> để báo
                lỗi khi liên hệ hỗ trợ. Chỉ retry lỗi 429 và 5xx, tôn trọng{" "}
                <code>retry_after_ms</code>.
              </p>
              <table className="aihub-schema" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Mã</th>
                    <th>Nguyên nhân</th>
                  </tr>
                </thead>
                <tbody>
                  {ERRORS.map((error) => (
                    <tr key={error.code}>
                      <td>{error.status}</td>
                      <td>
                        <code>{error.code}</code>
                      </td>
                      <td>{error.cause}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
            <li>
              <h3>Đưa lên production</h3>
              <p>
                Tạo một key riêng cho production, đặt hạn ngày hết hạn, và ghi
                log mọi lần gọi kèm <code>request_id</code>. Key do Console tạo
                luôn chạy trên production và tính phí ngay, kể cả lệnh gọi thử.
                Giới hạn 50 key mỗi Organization.
              </p>
            </li>
            <li>
              <h3>(Tuỳ chọn) Bật Signed User Assertion</h3>
              <p>
                Mặc định bạn gửi <code>X-User-Identity</code> dạng văn bản thuần
                — AIHUB chấp nhận và ghi nhận nó, nhưng bất kỳ ai giữ key của
                Organization cũng đặt được tên bất kỳ ai. Nếu cần chống giả mạo,
                mở trang Identity của Organization, khai báo issuer và JWKS, rồi
                ký một JWT ngắn hạn bằng private key của bạn ở backend. Cấu hình
                có hiệu lực sẽ bắt buộc dạng ký, và không có fallback xuống dạng
                thuần.
              </p>
            </li>
          </ol>
        </section>

        <section className="aihub-category">
          <div className="aihub-category-head">
            <h2 className="aihub-category-name">Bước tiếp theo</h2>
          </div>
          <div className="aihub-shortcuts">
            <Link className="aihub-card" href="/product">
              <h3 className="aihub-card-name">API reference</h3>
              <p className="aihub-card-desc">
                Danh sách endpoint, trường request, response mẫu và lỗi riêng
                của từng endpoint.
              </p>
              <span className="aihub-cta">Xem tài liệu API ›</span>
            </Link>
            <Link className="aihub-card" href="/demo">
              <h3 className="aihub-card-name">Demo trên trình duyệt</h3>
              <p className="aihub-card-desc">
                Xem backend gọi AIHUB thế nào mà không cần key của bạn.
              </p>
              <span className="aihub-cta">Mở demo ›</span>
            </Link>
            <Link className="aihub-card" href="/contact">
              <h3 className="aihub-card-name">Cần trợ giúp?</h3>
              <p className="aihub-card-desc">
                Gửi kèm <code>request_id</code> từ <code>meta</code> để AIHUB
                tra nhanh.
              </p>
              <span className="aihub-cta">Liên hệ ›</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
