import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { promptsForPart, type SpeakingPart } from "@/data/speaking-prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const part = Number(new URL(request.url).searchParams.get("part"));
  if (!Number.isInteger(part) || part < 1 || part > 3) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Part phải là 1, 2 hoặc 3." } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      data: { part, questions: promptsForPart(part as SpeakingPart) },
      meta: { request_id: `req_${randomUUID()}`, service: "speaking", operation: "speaking.questions" },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
