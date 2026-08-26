# TESTING — MOCK DATA & TEST FIXTURES

---

## 1. NGUYÊN TẮC QUẢN LÝ FIXTURES
- Giữ mock data cô lập, rõ nghĩa, và có tính tái sử dụng cao.
- Không để dữ liệu nhạy cảm hoặc API keys thật trong mock fixtures.

---

## 2. QUY ĐẶT TÊN
- Factory helpers: `createMockSample(overrides?: Partial<AcademicSample>): AcademicSample`
- Test fixtures đặt tại `tests/fixtures/` hoặc trực tiếp trong file test tương ứng nếu đặc thù.
