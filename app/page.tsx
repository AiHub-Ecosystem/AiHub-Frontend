import type { Metadata } from "next";
import { AihubLanding } from "@/components/landing/aihub-landing";
import { isSignedIn } from "@/components/site-chrome";
import "./landing.css";

export const metadata: Metadata = {
  title: "AiHub — API chấm IELTS Writing & Speaking",
  description:
    "Band 4 tiêu chí, câu sai có mã lỗi, giải thích tiếng Việt và bài luyện tiếp theo. Một API key, một HTTP request.",
};

export default async function Page() {
  return <AihubLanding signedIn={await isSignedIn()} />;
}
