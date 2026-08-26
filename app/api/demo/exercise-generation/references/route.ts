import { NextResponse } from "next/server";
import { sampleReferences, validateReferenceQuery, type ReferenceQuery } from "@/data/demo-mock";
import { DEFAULT_NUM_REFERENCES } from "@/data/aiwriting";

/**
 * Mock của POST /internal/micro-exercise/sample-references
 * (docs/briefapiinput.md). Không đọc DB thật — dữ liệu do data/demo-mock.ts
 * dựng ra. Giữ nguyên hình dạng response tài liệu mô tả, kể cả điểm bất hợp lý
 * đã ghi ở spec mục 6.7 (criterion trả về là display name).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const errors = validateReferenceQuery(body);
  if (errors.length > 0) {
    return NextResponse.json({ detail: errors }, { status: 422 });
  }

  const query = body as ReferenceQuery;
  await new Promise((resolve) => setTimeout(resolve, 500));

  return NextResponse.json(
    sampleReferences({ ...query, numReferences: query.numReferences ?? DEFAULT_NUM_REFERENCES }),
  );
}
