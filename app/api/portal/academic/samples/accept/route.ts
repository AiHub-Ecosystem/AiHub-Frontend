import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const BACKEND_URL = process.env.API_BASE_URL || "http://localhost:3020";
const LOCAL_DATA_PATH = path.resolve(process.cwd(), "..", "backend", "data", "academic_samples.json");

function getNextTopicRotation(currentTopic: string): string {
  const normalized = currentTopic.toLowerCase();
  if (normalized === "environment") return "technology";
  if (normalized === "technology") return "education";
  return "environment";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  // 1. Try forwarding to Backend Express API
  try {
    const backendRes = await fetch(`${BACKEND_URL}/portal/academic/samples/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (backendRes.ok) {
      const data = await backendRes.json();
      return NextResponse.json(data);
    }
  } catch {
    // Backend offline, fallback to local disk storage
  }

  // 2. Resilient local fallback
  try {
    let list: any[] = [];
    const dir = path.dirname(LOCAL_DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(LOCAL_DATA_PATH)) {
      const raw = fs.readFileSync(LOCAL_DATA_PATH, "utf-8");
      list = JSON.parse(raw);
    }

    const newRecord = {
      id: body.id || `sample_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      taskId: body.task_id || "task_2",
      topic: body.topic || "environment",
      criterion: body.criterion || "LR",
      errorCode: body.error_code || "collocation_error",
      questionType: body.question_type || "short_writing",
      detailedInstruction: body.detailed_instruction || "",
      studentInstruction: body.student_instruction || null,
      referencesJson: body.references || null,
      rawAiOutput: body.raw_ai_output || {},
      finalOutput: body.final_output || {},
      score: body.score ?? 9,
      status: "ACCEPTED",
      rejectReason: null,
      reviewedBy: body.reviewed_by || "Academic Specialist",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    list.unshift(newRecord);
    fs.writeFileSync(LOCAL_DATA_PATH, JSON.stringify(list, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      message: "Sample accepted and saved to training dataset",
      data: {
        ...newRecord,
        nextTopic: getNextTopicRotation(body.topic || "environment"),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
