# TESTING — QUY TẮC VIẾT INTEGRATION TEST

---

## 1. MỤC TIÊU
- Đảm bảo các Adapters (Prisma repository, Database query, HTTP server) tích hợp trơn tru với nhau.

---

## 2. QUY TẮC TRIỂN KHAI
1. Sử dụng database sandbox / in-memory fallback khi chạy môi trường test độc lập.
2. Dọn dẹp dữ liệu sau mỗi suite test (`afterEach` hoặc `afterAll`) để tránh làm ảnh hưởng lẫn nhau.
3. Test đầy đủ các kịch bản query phức tạp (pagination, filtering, sorting).
