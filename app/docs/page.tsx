import type { Metadata } from "next";
import Link from "next/link";
import { SANDBOX_ORGANIZATION_MONTHLY_ALLOWANCE } from "@/lib/api-keys";
import { CodeBlock } from "@/components/docs/code-block";
import {
  FIRST_CALL,
  NODE_SAMPLE,
  PRODUCTION_HOST,
  SANDBOX_HOST,
  SANDBOX_KEY_REQUEST,
  SIGN_JAVA,
  SIGN_NODE,
  SIGN_PYTHON,
  SIGNED_HEADER,
} from "@/data/docs-guide";
import "../aihub.css";
import "./docs.css";

export const metadata: Metadata = {
  title: "Hướng dẫn tích hợp — AIHub",
  description:
    "Các bước kết nối AIHUB, thử chấm Writing miễn phí và đưa tính năng chấm vào ứng dụng của bạn.",
};

const IDENTITY_MODES = [
  {
    state: "Chưa thiết lập xác minh chữ ký",
    mode: "Mã người học thông thường",
    value: "Mã người học của bạn",
    jwks: "Không cần",
  },
  {
    state: "Đã thiết lập nhưng đang tắt",
    mode: "Mã người học thông thường",
    value: "Mã người học của bạn",
    jwks: "Không cần",
  },
  {
    state: "Đang bật xác minh chữ ký",
    mode: "Mã có chữ ký",
    value: "Mã do máy chủ của bạn ký, có hạn dùng ngắn",
    jwks: "Cần",
  },
];

const ASSERTION_FIELDS = [
  {
    field: "alg (header)",
    value: "RS256 hoặc ES256",
    note: "HS256 và alg none bị từ chối.",
  },
  {
    field: "kid (header)",
    value: "Khớp đúng một khoá trong JWKS",
    note: "Một kid khớp nhiều khoá dùng được cũng bị từ chối.",
  },
  {
    field: "iss",
    value: "Issuer đã đăng ký",
    note: "Khớp từng ký tự.",
  },
  { field: "aud", value: '"aihub"', note: "Hằng số." },
  {
    field: "sub",
    value: "End-User ID",
    note: "Cùng quy tắc 1–256 ký tự với Declared User ID.",
  },
  {
    field: "jti",
    value: "ID duy nhất cho mỗi assertion",
    note: "Ví dụ một UUID mới.",
  },
  {
    field: "iat",
    value: "Thời điểm ký, tính bằng giây",
    note: "Không được ở tương lai quá 60 giây.",
  },
  {
    field: "exp",
    value: "Hết hạn, tính bằng giây",
    note: "Mặc định tối đa 300 giây (cấu hình max_assertion_ttl_seconds từ 1 đến 3600); ký ngay trước khi gọi.",
  },
];

const OPERATIONS = [
  {
    name: "Writing Task 1",
    href: "/product/scoring/api/grade-task1",
    path: "/v1/ielts/writing/task1/grade",
    scope: "writing.grade",
    idempotency: "Bắt buộc",
    body: "256 KB",
    budget: "60 giây",
    timeout: "90 giây",
  },
  {
    name: "Writing Task 2",
    href: "/product/scoring/api/grade-task2",
    path: "/v1/ielts/writing/task2/grade",
    scope: "writing.grade",
    idempotency: "Bắt buộc",
    body: "256 KB",
    budget: "60 giây",
    timeout: "90 giây",
  },
  {
    name: "Speaking multipart",
    href: "/product/speaking/api/speaking-grading",
    path: "/v1/ielts/speaking/grading",
    scope: "speaking.grade",
    idempotency: "Không hỗ trợ (header bị bỏ qua)",
    body: "26 MiB",
    budget: "60 giây",
    timeout: "90 giây",
  },
  {
    name: "Speaking JSON-by-URL",
    href: "/product/speaking/api/speaking-grading-json",
    path: "/v1/ielts/speaking/grading-json",
    scope: "speaking.grade",
    idempotency: "Không hỗ trợ (header bị bỏ qua)",
    body: "256 KB",
    budget: "30 giây",
    timeout: "60 giây",
  },
];

const ERRORS = [
  {
    status: "400",
    code: "INVALID_REQUEST",
    cause: "Body sai quy tắc hoặc có trường lạ.",
    action: "Sửa request. Retry vô ích.",
  },
  {
    status: "401",
    code: "UNAUTHORIZED",
    cause: "API key sai, đã thu hồi hoặc hết hạn.",
    action: "Kiểm tra key.",
  },
  {
    status: "401",
    code: "USER_IDENTITY_REQUIRED",
    cause: "Thiếu X-User-Identity trên thao tác chấm.",
    action: "Gửi X-User-Identity.",
  },
  {
    status: "401",
    code: "INVALID_USER_IDENTITY",
    cause:
      "Declared User ID vi phạm quy tắc, hoặc Signed User Assertion không qua được xác minh.",
    action:
      "Declared: sửa giá trị. Signed: ký assertion mới, kiểm tra issuer, kid và JWKS.",
  },
  {
    status: "403",
    code: "FORBIDDEN",
    cause: "Key thiếu scope của thao tác.",
    action: "Cấp key có scope phù hợp.",
  },
  {
    status: "403",
    code: "ENVIRONMENT_NOT_ALLOWED",
    cause: "Key không dùng được ở hostname này.",
    action: "Dùng key đi đúng cặp với host của nó.",
  },
  {
    status: "409",
    code: "IDEMPOTENCY_CONFLICT",
    cause:
      "Writing dùng lại Idempotency-Key với body khác, hoặc request giống hệt vẫn đang chạy.",
    action:
      "Body khác: lấy key mới. Đang chạy: chờ rồi thử lại với cùng key và cùng body.",
  },
  {
    status: "413",
    code: "PAYLOAD_TOO_LARGE",
    cause: "Body vượt trần của thao tác.",
    action: "Giảm kích thước bài viết hoặc âm thanh.",
  },
  {
    status: "429",
    code: "RATE_LIMITED",
    cause: "Quá nhiều request mỗi phút.",
    action: "Chờ retry_after_ms rồi thử lại.",
  },
  {
    status: "429",
    code: "CONCURRENCY_LIMIT",
    cause: "Quá nhiều request chạy cùng lúc.",
    action: "Giảm số request song song, dùng hàng đợi có số worker cố định.",
  },
  {
    status: "429",
    code: "QUOTA_EXCEEDED",
    cause: "Hết hạn mức của kỳ hiện tại.",
    action:
      "Đừng retry ngay: chờ tới lúc hạn mức hồi (có thể là đầu tháng UTC sau) hoặc liên hệ AIHUB.",
  },
  {
    status: "502 / 503",
    code: "AI_SERVICE_*",
    cause:
      "Dịch vụ chấm phía sau trả lỗi, quá tải hoặc không kết nối được (AI_SERVICE_ERROR, AI_SERVICE_THROTTLED, AI_SERVICE_UNAVAILABLE). AI_SERVICE_CONTRACT_VIOLATION là lỗi hình dạng dữ liệu.",
    action:
      "Retry có backoff khi retryable là true. Với CONTRACT_VIOLATION thì không retry, báo request_id.",
  },
  {
    status: "503",
    code: "IDENTITY_PROVIDER_UNAVAILABLE",
    cause:
      "AIHUB không đọc được Identity configuration (cả hai dạng định danh đều có thể gặp), hoặc không lấy được khoá public từ nguồn JWKS (chỉ dạng ký).",
    action:
      "Retry. Với dạng ký, kiểm tra nguồn JWKS đã cấu hình. API key không có lỗi.",
  },
  {
    status: "504",
    code: "AI_SERVICE_TIMEOUT",
    cause: "Chấm vượt ngân sách của thao tác.",
    action:
      "Writing: retry với cùng Idempotency-Key. Speaking: chỉ retry khi chấp nhận một lần chấm mới.",
  },
  {
    status: "500",
    code: "INTERNAL_ERROR",
    cause: "Lỗi phía AIHUB.",
    action: "Retry sau, báo request_id nếu lặp lại.",
  },
];

const CHECKLIST = [
  "Key có đúng scope: writing.grade cho Writing, speaking.grade cho Speaking.",
  "Mỗi key đi cặp với host của nó: production với api.aihubproduction.com, Customer Sandbox với sandbox.aihubproduction.com.",
  "Đã xác định dạng định danh của Organization và mọi request gửi đúng dạng đó.",
  "API key, Signed User Assertion và private key chỉ nằm trên server hoặc trong secret manager.",
  "Timeout phía client từ 90 giây (Writing, Speaking multipart) hoặc 60 giây (Speaking JSON-by-URL).",
  "Writing: một Idempotency-Key cho mỗi bài làm, retry với cùng key và cùng body. Speaking: không retry tự động.",
  "Retry dựa trên retryable và retry_after_ms, tối đa hai hoặc ba lần, có backoff ngẫu nhiên.",
  "Ghi log meta.request_id của mọi lần gọi. Key production riêng, có ngày hết hạn (tối đa 50 key mỗi Organization).",
];

const SECTIONS = [
  { id: "bat-dau", label: "Gọi thử lần đầu" },
  { id: "dinh-danh", label: "Nhận diện người học" },
  { id: "thiet-lap", label: "Tạo tài khoản và khóa" },
  { id: "thao-tac", label: "Chọn tính năng chấm" },
  { id: "sandbox", label: "Thử miễn phí" },
  { id: "do-tin-cay", label: "Xử lý khi có lỗi" },
  { id: "san-sang", label: "Kiểm tra trước khi dùng thật" },
];

export default function Page() {
  return (
    <div className="aihub aihub-docs">
      <div className="aihub-shell">
        <div className="docs-hero">
          <div className="docs-hero-copy">
            <p className="aihub-eyebrow">Hướng dẫn dành cho khách hàng</p>
            <h1 className="aihub-title">
              Đưa tính năng chấm AI vào ứng dụng của bạn
            </h1>
            <p className="aihub-lede">
              Từ tạo tài khoản đến lần chấm đầu tiên: làm theo từng bước, lấy
              đoạn mã có thể dùng ngay và tra cứu chi tiết khi cần.
            </p>
            <div className="docs-hero-actions">
              <a className="docs-primary-link" href="#bat-dau">
                Xem lệnh gọi mẫu <span aria-hidden="true">↗</span>
              </a>
              <a className="docs-secondary-link" href="#sandbox">
                Thử miễn phí trước
              </a>
            </div>
          </div>
          <div className="docs-route" aria-label="Lộ trình tích hợp">
            <p className="docs-route-title">Lộ trình của bạn</p>
            <ol>
              <li>
                <span>Tạo tài khoản</span>
                <small>Đăng ký và lấy khóa truy cập</small>
              </li>
              <li>
                <span>Chọn môi trường</span>
                <small>Thử miễn phí hoặc dùng thật</small>
              </li>
              <li>
                <span>Gọi API chấm</span>
                <small>Gửi bài làm từ máy chủ của bạn</small>
              </li>
            </ol>
          </div>
        </div>

        <div className="docs-layout">
          <nav className="aihub-toc" aria-label="Trong trang">
            <p>Trong hướng dẫn</p>
            {SECTIONS.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.label}
              </a>
            ))}
          </nav>
          <main className="docs-content">
            <section className="aihub-category" id="bat-dau">
              <div className="aihub-category-head">
                <h2 className="aihub-category-name">
                  Gọi thử lần đầu với mã người học
                </h2>
              </div>
              <p className="aihub-callout">
                Mỗi lần chấm cần một mã để biết bài làm thuộc về người học nào.
                Gửi mã đó trong <code>X-User-Identity</code>. JWKS (bộ khóa xác
                minh) là tuỳ chọn: nếu tổ chức chưa bật xác minh chữ ký, bạn chỉ
                cần gửi mã dạng văn bản.
              </p>
              <ul className="aihub-facts">
                <li>
                  <span className="aihub-facts-label">Địa chỉ dùng thật</span>
                  <span className="aihub-facts-value">{PRODUCTION_HOST}</span>
                </li>
                <li>
                  <span className="aihub-facts-label">Khóa truy cập</span>
                  <span className="aihub-facts-value">Header X-API-Key</span>
                </li>
                <li>
                  <span className="aihub-facts-label">Mã người học</span>
                  <span className="aihub-facts-value">
                    Header X-User-Identity
                  </span>
                </li>
              </ul>
              <p className="aihub-prose">
                Chạy lệnh dưới đây trên máy chủ hoặc terminal của bạn với API
                key đã tạo. Khi kết quả có <code>data</code> và{" "}
                <code>meta</code>, kết nối đã hoạt động. Chưa có khóa? Xem{" "}
                <a href="#thiet-lap">cách tạo tài khoản và API key</a>.
              </p>
              <aside className="docs-notice docs-notice--billing">
                <strong>Lưu ý về chi phí</strong>
                <p>
                  Khóa tạo trong Console dùng cho môi trường thật và tính phí
                  ngay, kể cả lần gọi thử. Muốn thử Writing miễn phí, hãy{" "}
                  <a href="#sandbox">dùng môi trường thử</a> trước.
                </p>
              </aside>
              <CodeBlock
                code={FIRST_CALL}
                label="Lệnh curl gọi thử Writing Task 2 (Declared User ID)"
              />
              <aside className="docs-notice docs-notice--security">
                <strong>Giữ khóa an toàn</strong>
                <p>
                  Chỉ gọi AIHUB từ máy chủ của bạn. Không đưa API key hoặc mã
                  xác minh có chữ ký vào trình duyệt hay ứng dụng di động.
                </p>
              </aside>
            </section>

            <section className="aihub-category" id="dinh-danh">
              <div className="aihub-category-head">
                <h2 className="aihub-category-name">
                  AIHUB biết người học nào đang dùng bằng cách nào?
                </h2>
                <p className="aihub-category-desc">
                  Mặc định, bạn gửi một mã người học ổn định. Chỉ cần thêm chữ
                  ký nếu tổ chức của bạn đã bật xác minh nâng cao.
                </p>
              </div>
              <div className="aihub-scroll">
                <table className="aihub-schema">
                  <thead>
                    <tr>
                      <th>Trạng thái xác minh</th>
                      <th>Cách gửi mã</th>
                      <th>Giá trị X-User-Identity</th>
                      <th>Cần JWKS?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {IDENTITY_MODES.map((row) => (
                      <tr key={row.state}>
                        <td>{row.state}</td>
                        <td>{row.mode}</td>
                        <td>{row.value}</td>
                        <td>{row.jwks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="aihub-prose">
                Xem trạng thái ở trang Identity của Organization trong{" "}
                <Link href="/console/orgs">Console</Link>. Cấu hình chỉ được lưu
                hoặc đã bị tắt thì chưa bật xác minh có chữ ký.
              </p>

              <h3 className="aihub-sub" id="declared">
                Mã người học thông thường (Declared User ID)
              </h3>
              <ul className="aihub-list">
                <li>
                  1–256 ký tự ASCII hiển thị, không có khoảng trắng. AIHUB so
                  sánh đúng như bạn gửi: <code>Student@X.com</code> và{" "}
                  <code>student@x.com</code> là hai người dùng.
                </li>
                <li>
                  Gửi cùng một giá trị cho cùng một người mỗi lần, để mức dùng
                  luôn tính về đúng người đó. Dùng ID ổn định.
                </li>
                <li>
                  Nên dùng ID không mang nghĩa (opaque) thay vì email: AIHUB lưu
                  giá trị này trong bản ghi sử dụng và chuyển tiếp nguyên văn
                  cho dịch vụ chấm, nên email trở thành dữ liệu cá nhân.
                </li>
              </ul>
              <p className="aihub-callout" style={{ marginTop: 16 }}>
                Ranh giới tin cậy: AIHUB tin Declared User ID đúng bằng mức nó
                tin API key. Ai giữ API key của Organization đều đặt được tên
                bất kỳ người dùng cuối nào trong Organization đó. Cần AIHUB xác
                minh rằng backend của bạn đã bảo lãnh cho từng người dùng thì
                bật Signed User Assertion bên dưới.
              </p>

              <h3 className="aihub-sub" id="signed">
                Khi cần xác minh nâng cao (Signed User Assertion)
              </h3>
              <ul className="aihub-list">
                <li>
                  Chỉ owner đang hoạt động của Organization lưu được cấu hình,
                  bằng{" "}
                  <code>
                    PUT /v1/organizations/{"{organization_id}"}/identity-config
                  </code>{" "}
                  với <code>Authorization: Bearer</code> User Access JWT. Đây là
                  credential của control plane, không phải API key dùng để chấm.
                  Console có sẵn trang Identity làm việc này.
                </li>
                <li>
                  Khai báo một <code>issuer</code> và đúng một nguồn khoá
                  public: URL JWKS HTTPS truy cập công khai được (
                  <code>jwks_url</code>), hoặc JWKS public dán trực tiếp (
                  <code>public_keys_jwks</code>). Không bao giờ gửi private key
                  cho AIHUB; private key ở lại backend của bạn. Có thể đặt thêm{" "}
                  <code>allowed_algorithms</code> (RS256, ES256) và{" "}
                  <code>max_assertion_ttl_seconds</code>.
                </li>
                <li>
                  Cấu hình áp dụng cho cả Organization, ở mọi environment của
                  nó. Đừng đổi issuer giữa các request, và đừng gửi issuer hay
                  JWKS như header khi chấm.
                </li>
                <li>
                  Khi có cấu hình đang hoạt động, mọi request phải mang một
                  assertion hợp lệ. Assertion sai bị trả{" "}
                  <code>401 INVALID_USER_IDENTITY</code>, không có fallback
                  xuống ID văn bản thuần, nên tích hợp lỗi ngay thay vì âm thầm
                  đổi mức bảo đảm.
                </li>
              </ul>
              <div className="aihub-scroll">
                <table className="aihub-schema">
                  <thead>
                    <tr>
                      <th>Trường</th>
                      <th>Giá trị</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ASSERTION_FIELDS.map((row) => (
                      <tr key={row.field}>
                        <td>{row.field}</td>
                        <td>{row.value}</td>
                        <td>{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="aihub-prose">
                Dạng ký chỉ đổi giá trị của header; phần còn lại của request giữ
                nguyên. Ký assertion ngay trước mỗi lần gọi ở backend, không lưu
                lâu và không đưa xuống trình duyệt hay mobile app.
              </p>
              <CodeBlock
                code={SIGNED_HEADER}
                label="Header X-User-Identity ở dạng ký"
              />
              <p className="aihub-prose">
                Mẫu ký assertion ở backend của bạn (Node.js, Python, Java). Thay
                các giá trị <code>{"<...>"}</code> bằng issuer và kid đã đăng
                ký; nạp private key từ secret manager.
              </p>
              <CodeBlock
                code={SIGN_NODE}
                label="Node.js: ký Signed User Assertion"
              />
              <CodeBlock
                code={SIGN_PYTHON}
                label="Python: ký Signed User Assertion"
              />
              <CodeBlock
                code={SIGN_JAVA}
                label="Java: ký Signed User Assertion"
              />
            </section>

            <section className="aihub-category" id="thiet-lap">
              <div className="aihub-category-head">
                <h2 className="aihub-category-name">
                  Tạo tài khoản và khóa truy cập
                </h2>
                <p className="aihub-category-desc">
                  Làm ba bước này trước khi gửi yêu cầu chấm. API key chỉ hiện
                  đầy đủ một lần sau khi tạo hoặc thay khóa.
                </p>
              </div>
              <ol className="aihub-steps">
                <li>
                  <h3>Đăng ký và xác minh email</h3>
                  <p>
                    <Link href="/register">Đăng ký</Link> bằng email, username
                    và mật khẩu, rồi mở email lấy link xác minh. Quên mật khẩu
                    thì dùng{" "}
                    <Link href="/forgot-password">khôi phục mật khẩu</Link>.
                  </p>
                </li>
                <li>
                  <h3>Tạo tổ chức</h3>
                  <p>
                    Tổ chức là nơi quản lý khóa truy cập và cách nhận diện người
                    học. Tạo ở <Link href="/console/orgs">Console</Link>. Mỗi
                    tài khoản tự tạo tối đa ba tổ chức; cần thêm thì liên hệ
                    AIHUB.
                  </p>
                </li>
                <li>
                  <h3>Tạo API key và lưu ngay</h3>
                  <p>
                    Vào trang API keys của Organization, bấm{" "}
                    <strong>Tạo API key</strong>, đặt tên và tick đúng scope cần
                    dùng. Scope chưa bật cho Organization sẽ bị khoá — liên hệ
                    AIHUB để mở. Lưu raw key vào secret manager rồi đóng dialog;
                    sẽ không xem lại được.
                  </p>
                </li>
              </ol>
            </section>

            <section className="aihub-category" id="thao-tac">
              <div className="aihub-category-head">
                <h2 className="aihub-category-name">
                  Chọn tính năng chấm bạn cần
                </h2>
                <p className="aihub-category-desc">
                  Chọn Writing hoặc Speaking rồi mở hướng dẫn chi tiết của tính
                  năng đó. Mọi lần chấm đều cần mã người học{" "}
                  <code>X-User-Identity</code>.
                </p>
              </div>
              <div className="aihub-scroll">
                <table className="aihub-schema">
                  <thead>
                    <tr>
                      <th>Tính năng</th>
                      <th>Đường dẫn API</th>
                      <th>Quyền cần cấp</th>
                      <th>Gửi lại an toàn</th>
                      <th>Dung lượng tối đa</th>
                      <th>Thời gian xử lý</th>
                      <th>Thời gian chờ nên đặt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {OPERATIONS.map((operation) => (
                      <tr key={operation.href}>
                        <td>
                          <Link href={operation.href}>{operation.name}</Link>
                        </td>
                        <td>
                          <code>{operation.path}</code>
                        </td>
                        <td>
                          <code>{operation.scope}</code>
                        </td>
                        <td>{operation.idempotency}</td>
                        <td>{operation.body}</td>
                        <td>{operation.budget}</td>
                        <td>Tối thiểu {operation.timeout}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="aihub-prose">
                Lệnh chạy sẵn cho đúng API key của bạn nằm ở Quickstart của key
                trong <Link href="/console/orgs">Console</Link>.
              </p>
              <h3 className="aihub-sub">Gắn vào backend</h3>
              <CodeBlock
                code={NODE_SAMPLE}
                label="Node.js: gọi Writing Task 2 từ backend"
              />
            </section>

            <section className="aihub-category" id="sandbox">
              <div className="aihub-category-head">
                <h2 className="aihub-category-name">
                  Thử chấm Writing miễn phí
                </h2>
                <p className="aihub-category-desc">
                  Môi trường Customer Sandbox dành cho Writing Task 1 và Task 2.
                  Bạn cần khóa riêng cho môi trường thử.
                </p>
              </div>
              <aside className="docs-notice docs-notice--sandbox">
                <strong>Khóa dùng thử khác khóa dùng thật</strong>
                <p>
                  Dùng <code>{SANDBOX_HOST}</code> với khóa Sandbox riêng. Khóa
                  tạo trong Console chỉ dùng cho môi trường thật.
                </p>
              </aside>
              <ul className="aihub-list">
                <li>
                  Có host riêng <code>{SANDBOX_HOST}</code> và API key riêng.
                  Key Sandbox chỉ chạy ở host này, key production chỉ chạy ở
                  host production; gọi sai host trả{" "}
                  <code>403 ENVIRONMENT_NOT_ALLOWED</code>.
                </li>
                <li>
                  Owner hoặc admin đang hoạt động cấp key qua control-plane API
                  bên dưới, với <code>allowed_environments</code> chỉ là{" "}
                  <code>sandbox</code> và <code>scopes</code> chỉ là{" "}
                  <code>writing.grade</code>. Form tạo key trong Console chỉ tạo
                  key production, nên đừng tìm lựa chọn Sandbox ở đó.
                </li>
                <li>
                  Miễn phí với khách, nhưng mỗi lần chấm vẫn gọi AI thật:{" "}
                  {SANDBOX_ORGANIZATION_MONTHLY_ALLOWANCE} lần mỗi Organization
                  mỗi tháng UTC, và 500 lần cho toàn bộ Sandbox mỗi tháng UTC
                  (tính cả lưu lượng demo của AIHUB nên có thể cạn trước khi
                  Organization dùng đủ hạn mức riêng). Một lần gọi phía sau lỗi
                  hoặc timeout vẫn tính vào hạn mức; replay idempotency đã hoàn
                  tất thì không gọi lại nên không tính.
                </li>
                <li>
                  Sandbox dùng đúng dạng định danh đang hoạt động của
                  Organization như production: Declared User ID hoặc Signed User
                  Assertion.
                </li>
              </ul>
              <CodeBlock
                code={SANDBOX_KEY_REQUEST}
                label="Request cấp Customer Sandbox API key"
              />

              <h3 className="aihub-sub">Demo assertion không dành cho khách</h3>
              <p className="aihub-prose">
                <code>POST /v1/sandbox/assertions</code> chỉ dùng được bởi
                Organization demo riêng của AIHUB, cùng Sandbox API key mà
                server AIHUB giữ. Đây không phải route ký assertion cho khách:
                Customer Sandbox API key của bạn không gọi được nó, và bạn không
                cần nó để tích hợp. Nếu Organization của bạn bật xác minh có chữ
                ký, hãy ký assertion bằng private key của chính bạn.
              </p>
            </section>

            <section className="aihub-category" id="do-tin-cay">
              <div className="aihub-category-head">
                <h2 className="aihub-category-name">Khi yêu cầu chấm bị lỗi</h2>
              </div>
              <ul className="aihub-list">
                <li>
                  <strong>Writing</strong> bắt buộc có{" "}
                  <code>Idempotency-Key</code>, lưu trạng thái replay 24 giờ.
                  Key dài 1–255 byte UTF-8. Retry thì dùng lại đúng key và đúng
                  body: AIHUB trả kết quả đã lưu thay vì chấm lại. Đổi body,
                  hoặc gửi lại khi request cũ vẫn đang chạy, có thể trả{" "}
                  <code>409 IDEMPOTENCY_CONFLICT</code>.
                </li>
                <li>
                  <strong>Speaking không có idempotency.</strong> Mỗi lần gửi
                  lại là một lần chấm mới, tính phí thêm. Đừng retry mù quáng;
                  hãy quyết định có chấp nhận chấm lại hay không.
                </li>
                <li>
                  Response thành công có dạng <code>{"{ data, meta }"}</code>.
                  Giữ <code>meta.request_id</code> của mỗi lần gọi để AIHUB tra
                  khi bạn cần hỗ trợ. Không gửi API key, assertion, bài viết hay
                  âm thanh cho hỗ trợ.
                </li>
                <li>
                  Lỗi có dạng{" "}
                  <code>{"{ error: { code, retryable, ... } }"}</code>. Rẽ nhánh
                  theo <code>code</code>, không theo <code>message</code>. Chỉ
                  retry khi <code>retryable</code> là true, và đợi{" "}
                  <code>retry_after_ms</code> khi có (nằm trong body, không phải
                  header <code>Retry-After</code>). Đừng retry mọi lỗi 5xx theo
                  status.
                </li>
                <li>
                  Retry tối đa hai hoặc ba lần với backoff ngẫu nhiên.{" "}
                  <code>RATE_LIMITED</code> nghĩa là chậm lại;{" "}
                  <code>CONCURRENCY_LIMIT</code> nghĩa là giảm số request chạy
                  cùng lúc; <code>QUOTA_EXCEEDED</code> có thể phải chờ tới
                  tháng UTC sau.
                </li>
                <li>
                  Ngân sách của Speaking multipart gồm cả thời gian tải âm thanh
                  lên, nên file lớn trên đường truyền chậm cần timeout client
                  lớn hơn mức tối thiểu ở <a href="#thao-tac">bảng thao tác</a>.
                </li>
              </ul>
              <p className="aihub-prose">
                Bảng dưới là tóm tắt chung. Lỗi riêng và response mẫu của từng
                thao tác nằm ở trang API Reference, link ở bảng thao tác.
              </p>
              <div className="aihub-scroll">
                <table className="aihub-schema">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Mã</th>
                      <th>Nguyên nhân</th>
                      <th>Việc cần làm</th>
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
                        <td>{error.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="aihub-category" id="san-sang">
              <div className="aihub-category-head">
                <h2 className="aihub-category-name">
                  Kiểm tra trước khi dùng thật
                </h2>
              </div>
              <ul className="aihub-list">
                {CHECKLIST.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="aihub-category">
              <div className="aihub-category-head">
                <h2 className="aihub-category-name">Bước tiếp theo</h2>
              </div>
              <div className="aihub-shortcuts">
                <Link className="aihub-card" href="/console/orgs">
                  <h3 className="aihub-card-name">Console</h3>
                  <p className="aihub-card-desc">
                    Tạo API key và lấy lệnh chạy sẵn cho đúng key ở Quickstart.
                  </p>
                  <span className="aihub-cta">Mở Console ›</span>
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
                    Gửi kèm <code>request_id</code> từ <code>meta</code> để
                    AIHUB tra nhanh.
                  </p>
                  <span className="aihub-cta">Liên hệ ›</span>
                </Link>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
