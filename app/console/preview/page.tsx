import type { Metadata } from "next";
import { ConsoleWorkbench } from "../console-workbench";

// Clickable prototype of the next Console, built from the "AIHub Console
// Prototype" design canvas. Every number, key and member on it is mock data
// from console-data.ts, so it needs no session; the real Console at /console
// (Organization roster, API keys) is unchanged until this UI is wired to it.
export const metadata: Metadata = {
  title: "AIHub Console (prototype) — Quản lý API & Dịch vụ IELTS",
  description:
    "Bản prototype Console: quản lý API key, tích hợp dịch vụ chấm chữa IELTS và theo dõi usage.",
  robots: { index: false },
};

export default function ConsolePreviewPage() {
  return <ConsoleWorkbench />;
}
