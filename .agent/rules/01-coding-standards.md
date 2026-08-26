# RULE 01 — CODING STANDARDS & CLEAN CODE

---

## 1. QUY CHUẨN TYPESCRIPT & ESM

1. **Module Resolution (`NodeNext`)**:
   - Tất cả internal relative imports BẮT BUỘC có đuôi `.js` (ví dụ: `import { config } from "./config.js";`).
   - Sử dụng `import type { ... }` khi chỉ import kiểu dữ liệu.

2. **Xử lý bất đồng bộ (Async / Await)**:
   - Sử dụng `async/await` nhất quán, không lạm dụng raw Promise callback chains `.then().catch()`.
   - Mọi Promise đều phải được `await` hoặc xử lý rejection cẩn thận.

3. **Strict Type Safety**:
   - Không sử dụng `any` trừ trường hợp bắt buộc (cần có comment giải thích lý do).
   - Sử dụng `unknown` kết hợp type guard hoặc Zod parsing khi nhận dữ liệu không xác định từ bên ngoài.

---

## 2. QUY CHUẨN XỬ LÝ LỖI (ERROR HANDLING)

1. Sử dụng hệ thống Error phân cấp từ `src/pkg/errors/app-error.ts`:
   - `NotFoundError` (404)
   - `ValidationError` (422)
   - `UnauthorizedError` (401)
   - `ForbiddenError` (403)
   - `ConflictError` (409)
   - `InternalServerError` (500)
2. Không nuốt lỗi ngầm (silent fail) hoặc `catch (e) {}` mà không ghi log hoặc rethrow có ngữ cảnh.
3. Không để lộ stack trace chi tiết của lỗi máy chủ trong môi trường Production.

---

## 3. QUY CHUẨN ĐẶT TÊN (NAMING CONVENTIONS)

- **File & Folder**: Kebab-case (ví dụ: `academic-sample.repository.ts`, `generate-academic-sample.usecase.ts`).
- **Interfaces / Types**: PascalCase, tiền tố `I` cho Port interfaces nếu cần phân biệt (ví dụ: `IAcademicSampleRepository`, `AcademicSample`).
- **Functions / Methods**: camelCase, mô tả rõ hành động (ví dụ: `generateAcademicSample`, `findById`).
- **Constants / Enums**: UPPER_SNAKE_CASE (ví dụ: `ERROR_CODES_TAXONOMY`).
