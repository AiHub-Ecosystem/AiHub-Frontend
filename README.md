# 🎨 AIHub Frontend — Giao Diện Người Dùng & Phòng Lab Academic

Phân hệ Frontend của AIHub xây dựng trên nền tảng **Next.js 16.3 (Turbopack), React 19, và CSS Design System `aihub.css`**.

---

## 🗺️ 1. Cấu Trúc Routing (28 Routes Hoàn Hảo)

```
app/
├── (Root)                      # / - Trang chủ AIHub
├── lab/                        # /lab - Phòng Lab Academic (Chấm điểm & Quản lý mẫu)
├── demo/                       # /demo - Danh mục Demo sản phẩm
│   └── exercise-generation/    # /demo/exercise-generation - Interactive Demo tạo bài tập 4 bước
├── product/                    # /product - Marketplace API & Tài liệu tổng quan
│   └── [slug]/                 # /product/scoring, /product/exercise-generation, /product/roadmap
│       └── api/[endpoint]/     # Chi tiết từng endpoint API Specs
├── pricing/                    # /pricing - Bảng giá & Gói cước
├── pricingcalculator/          # /pricingcalculator - Công cụ tính chi phí API
├── connectors/                 # /connectors - Tích hợp hệ thống
├── case-studies/               # /case-studies - Khách hàng tiêu biểu
├── community/                  # /community - Diễn đàn cộng đồng
├── podcasts/                   # /podcasts - Podcast học thuật
├── blog/                       # /blog - Tin tức & Bài viết
├── contact/                    # /contact - Liên hệ
├── about/                      # /about - Giới thiệu đội ngũ
├── privacy-policy/             # /privacy-policy - Chính sách bảo mật
└── terms-of-service/           # /terms-of-service - Điều khoản dịch vụ
```

---

## 🧪 2. Tính Năng Trọng Tâm: Phòng Lab Academic (`/lab`)

Giao diện phòng Lab được thiết kế đồng nhất 100% với phong cách hiện đại của trang Demo ([`aihub.css`](file:///d:/AiHub/frontend/app/aihub.css)), gồm 2 phân hệ:

### A. Tab "🧪 Phòng Lab Tạo & Chấm Điểm"
* **Cột Trái (Wizard 4 Bước)**:
  1. **Bước 1 — Chọn tiêu chí**: Chọn Task (Task 1 / 2), Topic, Criteria, Error Code (28 mã lỗi IELTS), Question Type.
  2. **Bước 2 — Lấy dữ liệu tham chiếu**: Gọi API truy vấn ngân hàng bài làm học viên WISPACE.
  3. **Bước 3 — AI Sinh bài tập**: Kích hoạt mô hình AI sinh câu hỏi, gợi ý Hints, đáp án mẫu.
  4. **Bước 4 — Chấm điểm & Quyết định**:
     * ⭐ Thanh trượt **Chấm điểm chất lượng AI (Thang 1–10)**.
     * **Nút `✓ Accept (Lưu vào DB)`**: Lưu bản đã sửa + điểm số vào Database và tự động xoay vòng chủ đề kế tiếp (`Environment` $\rightarrow$ `Technology` $\rightarrow$ `Education`).
     * **Nút `✕ Reject (Kèm lý do)`**: Mở modal nhập lý do từ chối $\rightarrow$ Lưu lý do + điểm số + mẫu vào Database để phục vụ fine-tuning mô hình AI.
* **Cột Phải (Live Terminal & Interactive Editor)**:
  * **Chế độ `👁️ Xem bài tập (Preview)`**: Hiển thị bài tập chuẩn đẹp với tiêu đề câu, chip Hints bo tròn, khung viền đáp án mẫu, **khối AI Grading Rubric 1–10** màu hổ phách và giải thích học thuật.
  * **Chế độ `✏️ Sửa trực tiếp (Edit Mode)`**: Cho phép chuyên viên sửa trực tiếp từng trường nội dung đề bài, đáp án mẫu, rubric.
  * **Chế độ `Request` & `Response JSON`**: Xem payload cURL và JSON thô.

### B. Tab "📂 Kho Mẫu Đã Lưu"
* Bảng danh sách toàn bộ các bài tập đã được duyệt/từ chối trong cơ sở dữ liệu.
* Bộ lọc trạng thái (`ACCEPTED` / `REJECTED`) và modal xem chi tiết bản xuất xưởng.

---

## 🎨 3. Design System & Brand Identity

* **Thanh Header**: Đã thêm thẻ **`Lab`** nằm ngay cạnh **`Demo`** trên thanh menu điều hướng toàn trang.
* **Hệ thống màu sắc**:
  * Brand Blue: `#3a64fa`
  * Deep Purple: `#311772` / `#240b54` (AiHub Hero & Brand)
  * Ink Text: `#1d2838`
  * Surface Background: `#eae5fc` / `#f8fafc`
  * Success Green: `#10b981` / `#065f46`
  * Amber Warning: `#f59e0b` / `#92400e`

---

## 🚀 4. Tình Trạng Hiện Tại

* **Next.js Turbopack Build**: `npm run build` $\rightarrow$ **28/28 routes biên dịch thành công 100% không lỗi**.
* **Khởi chạy phát triển**: `npm run dev` (chạy tại `http://localhost:3000`).
