import { NextResponse } from "next/server";
import { sampleReferences, validateReferenceQuery, type ReferenceQuery } from "@/data/demo-mock";
import { DEFAULT_NUM_REFERENCES } from "@/data/aiwriting";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const errors = validateReferenceQuery(body);
  if (errors.length > 0) {
    return NextResponse.json({ detail: errors }, { status: 422 });
  }

  const query = body as ReferenceQuery;
  const numRef = query.numReferences ?? DEFAULT_NUM_REFERENCES;

  // 1. Try calling the real Backend Reference API
  try {
    const backendRes = await fetch("http://localhost:3020/internal/micro-exercise/sample-references", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writing_task: query.writingTask,
        task_id: `task_${query.writingTask}`,
        criterion: query.criterion,
        error_code: query.errorCode,
        topic: query.topic,
        num_reference: numRef,
        num_references: numRef,
      }),
    });

    if (backendRes.ok) {
      const json = await backendRes.json();
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        return NextResponse.json({
          topic: query.topic,
          writing_task: query.writingTask,
          criterion: query.criterion,
          error_code: query.errorCode,
          references: json.data.map((r: any) => ({
            question: { prompt: r.prompt, question_type: r.questionType || "agree_disagree" },
            comments: [{ quote: r.quote || "", explanation: r.explanation || "" }],
          })),
        });
      }
      if (json.references && Array.isArray(json.references) && json.references.length > 0) {
        return NextResponse.json(json);
      }
    }
  } catch {
    // Fallback to local mock references if backend is unreachable
  }

  // 2. Fallback to mock dataset
  return NextResponse.json(
    sampleReferences({ ...query, numReferences: numRef }),
  );
}
