# WORKFLOW — CODE REVIEW CHECKLIST (TỰ DUYỆT TRƯỚC KHI TRẢ KẾT QUẢ)

Trước khi Agent báo cáo hoàn thành cho Operator, BẮT BUỘC kiểm tra qua các mục sau:

---

## 1. Clean Architecture Check
- [ ] Tầng `domain/` có bị dính bất kỳ thư viện ngoài (Prisma, Express, Axios) không? -> **Phải là KHÔNG**.
- [ ] Tầng `application/` có phụ thuộc trực tiếp vào tầng `adapters/` không? -> **Phải là KHÔNG** (chỉ dùng Output Ports).
- [ ] Các Controller có chứa business logic phức tạp không? -> **Phải là KHÔNG** (phải chuyển vào Use Case).

## 2. Type Safety & ESM Check
- [ ] Tất cả file import nội bộ đã có đuôi `.js` chưa? -> **Phải có**.
- [ ] Chạy `npm run lint` (`tsc --noEmit`) có lỗi không? -> **Phải là 0 lỗi**.

## 3. Test & Verification Check
- [ ] Chạy `npm test` có pass 100% không? -> **Phải pass**.
- [ ] Các use case mới đã có unit test tương ứng chưa? -> **Phải có**.

## 4. Hygiene Check
- [ ] Có console.log rác hay hardcoded credentials không? -> **Không**.
- [ ] API responses có trả về đúng format `success`, `data`, `meta` không? -> **Đúng**.
