import { handleWritingChartUpload } from "@/lib/scoring-chart-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { assetId } = await params;
  return handleWritingChartUpload(request, "refresh", assetId);
}
