import type { Metadata } from "next";
import { UniversalSpecView } from "./universal-spec-view";
import "../aihub.css";

export const metadata: Metadata = {
  title: "Universal AI Specs & cURL Builder — AIHub",
  description:
    "Tra cứu tài liệu API đa lĩnh vực, chỉnh sửa request mẫu và tạo lệnh cURL để chạy bên ngoài Customer Web. Trang này không thực thi request.",
};

export default function Page() {
  return <UniversalSpecView />;
}
