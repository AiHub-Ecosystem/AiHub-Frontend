import { NextResponse } from "next/server";
import {
  sampleReferences,
  validateReferenceQuery,
  type ReferenceQuery,
} from "@/data/demo-mock";
import { DEFAULT_NUM_REFERENCES } from "@/data/aiwriting";

// The backend returns sample references flat, not in the nested MockReference
// shape the mock generator produces.
type SampleReference = {
  prompt: string;
  questionType?: string;
  quote?: string;
  explanation?: string;
};

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
    const backendUrl =
      process.env.API_BASE_URL ||
      process.env.BACKEND_URL ||
      "http://localhost:3020";
    const backendRes = await fetch(
      `${backendUrl.replace(/\/$/, "")}/external/micro-exercise/sample-references`,
      {
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
      }
    );

    if (backendRes.ok) {
      const json = await backendRes.json();
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        return NextResponse.json({
          topic: query.topic,
          writing_task: query.writingTask,
          criterion: query.criterion,
          error_code: query.errorCode,
          references: (json.data as SampleReference[]).map((r) => ({
            question: {
              prompt: r.prompt,
              question_type: r.questionType || "agree_disagree",
            },
            comments: [
              { quote: r.quote || "", explanation: r.explanation || "" },
            ],
          })),
        });
      }
      if (
        json.references &&
        Array.isArray(json.references) &&
        json.references.length > 0
      ) {
        return NextResponse.json(json);
      }
    }
  } catch {
    // Fallback to local mock references if backend is unreachable
  }

  // 2. Fallback to mock dataset
  return NextResponse.json(
    sampleReferences({ ...query, numReferences: numRef })
  );
}
