import type { Metadata } from "next";
import { AcademicLabView } from "./academic-lab-view";
import "../aihub.css";

export const metadata: Metadata = {
  title: "Phòng Lab Academic — Chấm Điểm & Quản Lý Mẫu — AIHub",
  description: "Phòng Lab nội bộ dành cho đội ngũ Academic chuyên viên chấm điểm, review bài tập và lưu trữ dữ liệu huấn luyện vào database.",
};

export default function Page() {
  return <AcademicLabView />;
}
