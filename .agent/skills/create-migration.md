# SKILL — QUY TRÌNH TẠO VÀ CHẠY DATABASE MIGRATION

---

## 1. NGUYÊN TẮC
- Mọi thay đổi schema cơ sở dữ liệu phải được định nghĩa trong `prisma/schema.prisma`.
- Luôn kiểm tra tính tương thích xuôi (forward-compatible). Không xóa cột khi chưa có kế hoạch deprecate.

---

## 2. CÁC BƯỚC THỰC HIỆN

1. **Cập nhật Schema**:
   Chỉnh sửa model trong `prisma/schema.prisma`.

2. **Sinh Migration file**:
   ```bash
   npx prisma migrate dev --name <ten_migration_ngan_gon>
   ```

3. **Cập nhật Prisma Client**:
   ```bash
   npx prisma generate
   ```

4. **Kiểm tra / Cập nhật Seed data**:
   Nếu có trường bắt buộc mới, cập nhật `prisma/seed.ts`.
