import type { Metadata } from "next";
import ScoringWorkbench from "./scoring-workbench";
import "../../aihub.css";
import "./scoring.css";

export const metadata: Metadata = {
  title: "Demo — AI Chấm điểm — AIHub",
  description: "Chạy thử API chấm bài IELTS Writing Task 1 và Task 2 của AIHub.",
};

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="aihub aihub--flush">
      <ScoringWorkbench />
    </div>
  );
}
