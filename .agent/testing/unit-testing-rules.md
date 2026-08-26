# TESTING — QUY TẮC VIẾT UNIT TEST

---

## 1. MỤC TIÊU
- Unit test phải chạy cực nhanh (< 1 giây cho toàn bộ suite).
- Không được kết nối DB thật hoặc gọi mạng ngoài.

---

## 2. QUY TẮC TRIỂN KHAI
1. **Domain Tests**: Test các hàm logic tính toán, taxonomy, entity constraints trực tiếp.
2. **Use Case Tests**: 
   - Mock tất cả các Output Ports (ví dụ: `IAcademicSampleRepository`, `ISampleReferenceRepository`, `ILLMProvider`).
   - Test các luồng thành công (happy path), các luồng lỗi (error handling, invalid input, fallback logic).
3. Sử dụng `describe`, `it`, `expect` từ `vitest`.
