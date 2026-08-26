# WORKFLOW — REFACTORING AN TOÀN (SAFE REFACTORING)

---

## 1. NGUYÊN TẮC
- Refactor là thay đổi cấu trúc mã nguồn nội bộ mà **KHÔNG thay đổi hành vi bên ngoài (external behavior)**.
- Luôn có bài kiểm thử (test suite) bảo vệ trước khi bắt đầu di chuyển code.

---

## 2. QUY TRÌNH 4 BƯỚC

1. **Step 1: Baseline Check** — Chạy test hiện tại để đảm bảo toàn bộ hệ thống đang xanh (Green).
2. **Step 2: Migrate Core Domain & Application** — Chuyển đổi models, taxonomy, và use cases mới song song.
3. **Step 3: Migrate Adapters & Wire-up** — Chuyển controllers, repositories, routers nối vào use cases mới.
4. **Step 4: Verify & Cleanup** — Chạy lại toàn bộ test suite, kiểm tra lint, và xóa code cũ không còn dùng.
