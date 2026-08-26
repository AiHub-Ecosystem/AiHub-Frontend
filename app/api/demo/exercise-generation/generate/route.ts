import { NextResponse } from "next/server";
import { findErrorCode, TOPIC_LABELS, type Topic } from "@/data/aiwriting";
import { generateExercise, validateGenerateRequest, type GenerateRequest } from "@/data/demo-mock";

/**
 * Mock của POST /create-micro-exercise (docs/doc-api-micro.md mục 1).
 * Response theo đúng khung success/message/data/meta/exercise của tài liệu.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const errors = validateGenerateRequest(body);
  if (errors.length > 0) {
    return NextResponse.json({ detail: errors }, { status: 422 });
  }

  const req = body as GenerateRequest;
  const errorCode = findErrorCode(req.criterion, req.errorCode)!;
  await new Promise((resolve) => setTimeout(resolve, 700));

  return NextResponse.json(generateExercise(req, TOPIC_LABELS[req.topic as Topic], errorCode));
}
