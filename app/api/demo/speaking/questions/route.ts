import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { readDemoEnvironment } from "@/lib/demo-gateway";
import { getDemoBaseUrl, SpeakingBoundaryError } from "@/lib/speaking-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpstreamQuestion = {
  question_id: string;
  part: number;
  prompt_text: string;
  audio_url: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseQuestions(
  payload: unknown,
  part: number
): UpstreamQuestion[] | null {
  if (
    !isRecord(payload) ||
    !isRecord(payload.data) ||
    !Array.isArray(payload.data.questions)
  )
    return null;
  const questions = payload.data.questions.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.question_id !== "string" ||
      typeof item.part !== "number" ||
      typeof item.prompt_text !== "string" ||
      typeof item.audio_url !== "string"
    )
      return null;
    return {
      question_id: item.question_id,
      part: item.part,
      prompt_text: item.prompt_text,
      audio_url: item.audio_url,
    } satisfies UpstreamQuestion;
  });
  if (questions.some((item) => item === null)) return null;
  return questions
    .filter((item): item is UpstreamQuestion => item !== null)
    .filter((item) => item.part === part);
}

export async function GET(request: Request) {
  const part = Number(new URL(request.url).searchParams.get("part"));
  if (!Number.isInteger(part) || part < 1 || part > 3) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Part phải là 1, 2 hoặc 3.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const requestId = `req_${randomUUID()}`;
  try {
    const upstreamUrl = new URL(
      "/v1/ielts/speaking/questions",
      // The catalog is public and unauthenticated, but it still answers for the
      // tier the visit selected, so it follows that host rather than a default.
      `${getDemoBaseUrl(readDemoEnvironment(request))}/`
    );
    upstreamUrl.searchParams.set("part", String(part));
    const response = await fetch(upstreamUrl, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const payload: unknown = await response.json().catch(() => null);
    const questions = response.ok ? parseQuestions(payload, part) : null;
    if (!questions) throw new SpeakingBoundaryError("AI_SERVICE_UNAVAILABLE");

    return NextResponse.json(
      {
        data: {
          part,
          questions: questions.map((question) => ({
            id: question.question_id,
            part: question.part,
            question: question.prompt_text,
            sampleAudioUrl: question.audio_url,
          })),
        },
        meta: {
          request_id: requestId,
          service: "speaking",
          operation: "speaking.questions",
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "AI_SERVICE_UNAVAILABLE",
          message: "Không tải được danh sách câu hỏi.",
        },
        meta: { request_id: requestId, service: "speaking" },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
