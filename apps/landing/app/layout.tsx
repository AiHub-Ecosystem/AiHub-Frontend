import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AIHub — Luyện viết IELTS thông minh hơn",
  description:
    "AIHub là nền tảng API AI cho giáo dục — bắt đầu với AIWriting, sinh bài tập luyện viết bám đúng lỗi sai thật của học viên.",
};

export default function LandingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        <link rel="stylesheet" href="/meltano-source.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
