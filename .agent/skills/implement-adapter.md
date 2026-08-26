# SKILL — HƯỚNG DẪN TRIỂN KHAI ADAPTER MỚI

Khi cần kết nối với Database mới, LLM Model mới, hoặc Third-Party API mới:

---

## 1. Adapter Persistence (Database / Cache)
- Vị trí: `src/adapters/out/persistence/<ten_cong_nghe>/`
- Phải implements interface Output Port từ `src/application/ports/out/`.
- Thực hiện map giữa DB Model nội bộ và Domain Entity trước khi trả về.

## 2. Adapter LLM Provider
- Vị trí: `src/adapters/out/llm/<provider_name>.adapter.ts`
- Phải implements interface `ILLMProvider` hoặc port tương ứng.
- Đảm bảo có cơ chế fallback hoặc timeout an toàn khi API nhà cung cấp gặp sự cố.

## 3. Integration Testing
- Viết integration test trong `tests/integration/` để kiểm tra adapter hoạt động đúng với môi trường thực tế / mock server.
