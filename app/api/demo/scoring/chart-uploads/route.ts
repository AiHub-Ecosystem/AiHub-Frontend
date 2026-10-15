import { handleWritingChartUpload } from "@/lib/scoring-chart-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleWritingChartUpload(request, "create");
}
