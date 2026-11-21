import type { Metadata } from "next";
import { ConsoleWorkbench } from "../console-workbench";

export const metadata: Metadata = {
  title: "AIHub Console — Quản lý 5 API & Dịch vụ IELTS",
  description:
    "AIHub Console: quản lý API key, tích hợp 5 dịch vụ IELTS (4 kỹ năng) và theo dõi usage.",
  robots: { index: false },
};

export default function ConsolePreviewPage() {
  return <ConsoleWorkbench />;
}
