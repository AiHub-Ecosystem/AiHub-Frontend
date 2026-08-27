import type { Metadata } from "next";
import { UniversalSpecView } from "./universal-spec-view";
import "../aihub.css";

export const metadata: Metadata = {
  title: "Universal AI Specs & Live cURL Sandbox — AIHub",
  description: "Trang web quy chuẩn kết nối giữa Team Dev và Team AI. Định nghĩa đặc tả API đa lĩnh vực (EdTech, Legal, Fintech, Healthcare) và kiểm thử cURL trực tiếp trên trình duyệt.",
};

export default function Page() {
  return <UniversalSpecView />;
}
