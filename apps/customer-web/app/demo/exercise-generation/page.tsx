import type { Metadata } from "next";
import { ExerciseGenerationDemo } from "./exercise-generation-demo";
import "../../aihub.css";

export const metadata: Metadata = {
  title: "Demo — Tạo bài tập — AIHub",
  description: "Chạy thử luồng tạo bài tập luyện viết của AIHub ngay trên trình duyệt.",
};

export default function Page() {
  return <ExerciseGenerationDemo />;
}
