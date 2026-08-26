# RULE 02 — SECURITY GUIDELINES

---

## 1. QUẢN LÝ SECRETS & BIẾN MÔI TRƯỜNG
- **Tuyệt đối KHÔNG commit secrets** (API keys, JWT secrets, passwords, tokens) vào git repository.
- Mọi cấu hình nhạy cảm phải được khai báo trong `.env` và validate qua Zod schema tại `src/config/env.config.ts`.
- Mẫu `.env.example` phải luôn được cập nhật khi có biến môi trường mới (nhưng chỉ chứa giá trị mẫu/rỗng).

---

## 2. BẢO VỆ ĐẦU VÀO & API BOUNDARY
- **Validation-First**: Mọi request body / query parameters đều phải được validate bằng Zod DTO schema trước khi chuyển vào tầng Application/Domain.
- **SQL Injection / NoSQL Injection**: Luôn sử dụng ORM (Prisma) Parameterized Queries. Tuyệt đối cấm ghép chuỗi SQL thủ công (`$queryRawUnsafe` có tham số người dùng).
- **XSS & Output Encoding**: Sử dụng `helmet` cho HTTP header security, sanitized JSON responses.
- **Rate Limiting**: Áp dụng `rate-limit.middleware.ts` cho các API công khai và API AI engine để chống DoS và cạn kiệt LLM tokens.

---

## 3. AUTHN & AUTHZ
- Phân biệt rõ ràng giữa Xác thực (Authentication - Client ID / Session / Token) và Phân quyền (Authorization - Role USER / ADMIN).
- Mặc định bảo vệ các route nhạy cảm với `requireAuth` và `requireAdmin`.
