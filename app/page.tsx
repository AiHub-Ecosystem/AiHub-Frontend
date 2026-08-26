import type { Metadata } from "next";
import { MirrorPage } from "@/components/mirror-page";

export const metadata: Metadata = {
  title: "AIHub — Luyện viết IELTS thông minh hơn",
  description:
    "AIHub là nền tảng API AI cho giáo dục — bắt đầu với AIWriting, sinh bài tập luyện viết bám đúng lỗi sai thật của học viên.",
};

export default function Page() {
  return <MirrorPage name="home" />;
}
