import { NextResponse } from "next/server";
import { findErrorCode, TOPIC_LABELS, type Topic } from "@/data/aiwriting";
import { generateExercise, validateGenerateRequest, type GenerateRequest } from "@/data/demo-mock";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const errors = validateGenerateRequest(body);
  if (errors.length > 0) {
    return NextResponse.json({ detail: errors }, { status: 422 });
  }

  const req = body as GenerateRequest;

  // 1. Try calling the real Backend Exercise Generator
  try {
    const backendRes = await fetch("http://localhost:3020/create-micro-exercise", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": "demo-sandbox",
      },
      body: JSON.stringify({
        task_id: `task_${req.writingTask}`,
        topic: req.topic,
        criterion: req.criterion,
        error_code: req.errorCode,
        num_questions: (req as any).numQuestions || 3,
      }),
    });

    if (backendRes.ok) {
      const json = await backendRes.json();
      if (json.data) {
        return NextResponse.json(json);
      }
    }
  } catch {
    // Fallback to local mock generator if backend is unreachable
  }

  // 2. Fallback to mock exercise generator
  const errorCode = findErrorCode(req.criterion, req.errorCode)!;
  await new Promise((resolve) => setTimeout(resolve, 300));
  return NextResponse.json(generateExercise(req, TOPIC_LABELS[req.topic as Topic], errorCode));
}
