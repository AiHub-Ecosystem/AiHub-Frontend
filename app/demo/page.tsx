import type { Metadata } from "next";
import { DemoCatalog } from "./demo-catalog";
import "../aihub.css";

export const metadata: Metadata = {
  title: "Demo — AIHub",
  description: "Chạy thử các API của AIHub ngay trên trình duyệt.",
};

export default function Page() {
  return (
    <div className="aihub aihub--flush">
      <div className="aihub-shell">
        <DemoCatalog />
      </div>
    </div>
  );
}
