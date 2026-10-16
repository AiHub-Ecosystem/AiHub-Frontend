export const PRODUCTION_HOST = "https://api.aihubproduction.com";
export const SANDBOX_HOST = "https://sandbox.aihubproduction.com";

export const FIRST_CALL = `# 1. Lưu key vào biến môi trường (chỉ trong terminal server, không commit)
export AIHUB_API_KEY="aihub_sk_..."

# 2. End-User ID của bạn — ổn định, 1–256 ký tự ASCII hiển thị, không khoảng trắng
export AIHUB_USER_IDENTITY="student_456"

# 3. Gọi thử một lần chấm Writing Task 2
curl -X POST '${PRODUCTION_HOST}/v1/ielts/writing/task2/grade' \\
  -H "X-API-Key: $AIHUB_API_KEY" \\
  -H "X-User-Identity: $AIHUB_USER_IDENTITY" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{
    "topic": "education",
    "question": "Some people believe that universities should only offer academic subjects, while others think vocational training is equally important. Discuss both views and give your own opinion.",
    "essay": "Universities have traditionally focused on academic subjects, yet the value of vocational training is increasingly recognised..."
  }'`;

export const NODE_SAMPLE = `// backend/grading.js — gọi AIHUB từ server, không bao giờ từ trình duyệt
const AIHUB_HOST = "${PRODUCTION_HOST}";

// idempotencyKey: sinh MỘT lần cho mỗi bài làm (ví dụ randomUUID()), lưu cùng bài làm,
// và dùng lại đúng key này ở mọi lần retry. Đừng sinh key mới bên trong hàm này.
export async function gradeTask2({ question, topic, essay, endUserId, idempotencyKey }) {
  const response = await fetch(\`\${AIHUB_HOST}/v1/ielts/writing/task2/grade\`, {
    method: "POST",
    signal: AbortSignal.timeout(90_000), // ngân sách AIHUB là 60 giây; client chờ tối thiểu 90 giây
    headers: {
      "X-API-Key": process.env.AIHUB_API_KEY,
      "X-User-Identity": endUserId, // Declared User ID, hoặc Signed User Assertion nếu Organization bật xác minh
      "Idempotency-Key": idempotencyKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question, topic, essay }),
  });

  // Mọi response thành công đều bọc trong { data, meta }.
  if (response.ok) return (await response.json()).data;

  // Lỗi: rẽ nhánh theo error.code, quyết định retry theo retryable / retry_after_ms.
  const { error } = await response.json();
  throw Object.assign(new Error(\`AIHUB \${response.status} \${error.code}\`), {
    code: error.code,
    retryable: error.retryable,
    retryAfterMs: error.retry_after_ms,
    requestId: error.request_id, // gửi cho hỗ trợ, đừng gửi kèm key hay bài làm
  });
}`;

export const SIGNED_HEADER = `# SIGNED_USER_ASSERTION do backend của bạn ký ngay trước mỗi lần gọi
-H "X-User-Identity: $SIGNED_USER_ASSERTION"`;

export const SANDBOX_KEY_REQUEST = `POST /v1/organizations/{organization_id}/api-keys
Authorization: Bearer <User Access JWT của owner hoặc admin>
Content-Type: application/json

{
  "name": "scoring-demo-sandbox",
  "scopes": ["writing.grade", "speaking.grade"],
  "allowed_environments": ["sandbox"]
}`;

// Mẫu ký Signed User Assertion. Chạy ở backend của khách; private key không bao giờ
// rời khỏi đó. Các giá trị <...> là placeholder, thay bằng giá trị đã đăng ký.
export const SIGN_NODE = `// backend/assertion.js — chạy trên server của bạn, không bao giờ trong trình duyệt
import { SignJWT, importPKCS8 } from "jose";
import { randomUUID } from "node:crypto";

const privateKey = await importPKCS8(process.env.SIGNING_KEY_PEM, "RS256");

export async function mintAssertion(userId) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "<kid-co-trong-jwks>" })
    .setIssuer("<issuer-da-dang-ky>")
    .setAudience("aihub")
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}`;

export const SIGN_PYTHON = `# backend/assertion.py — PyJWT
import time, uuid, jwt

def mint_assertion(user_id: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "iss": "<issuer-da-dang-ky>",
            "aud": "aihub",
            "sub": user_id,
            "jti": str(uuid.uuid4()),
            "iat": now,
            "exp": now + 300,
        },
        PRIVATE_KEY_PEM,  # nạp từ secret manager
        algorithm="RS256",
        headers={"kid": "<kid-co-trong-jwks>"},
    )`;

export const SIGN_JAVA = `// com.nimbusds:nimbus-jose-jwt
var claims = new JWTClaimsSet.Builder()
    .issuer("<issuer-da-dang-ky>")
    .audience("aihub")
    .subject(userId)
    .jwtID(UUID.randomUUID().toString())
    .issueTime(new Date())
    .expirationTime(new Date(System.currentTimeMillis() + 300_000))
    .build();

var jwt = new SignedJWT(
    new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("<kid-co-trong-jwks>").build(),
    claims);
jwt.sign(new RSASSASigner(privateKey));
String assertion = jwt.serialize();`;

export const DEMO_ASSERTION_SUCCESS = `HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store
Access-Control-Allow-Origin: https://aihubproduction.com

{
  "assertion": "<signed-user-assertion-jwt>",
  "expires_at": "2026-10-16T12:05:00Z"
}`;

export const DEMO_ASSERTION_ERROR = `HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Access-Control-Allow-Origin: https://aihubproduction.com

{
  "error": {
    "code": "RATE_LIMITED"
  }
}`;
