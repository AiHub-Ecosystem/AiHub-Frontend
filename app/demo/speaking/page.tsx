import type { Metadata } from "next";
import SpeakingWorkbench from "./speaking-workbench";
import "../../aihub.css";
import "./speaking.css";

export const metadata: Metadata = {
  title: "Demo — AI Speaking — AIHub",
  description: "Chạy thử API chấm IELTS Speaking của AIHub.",
};

export const dynamic = "force-dynamic";

export default function Page() {
  return <div className="aihub aihub--flush"><SpeakingWorkbench /></div>;
}
