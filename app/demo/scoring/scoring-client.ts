import { WRITING_TASK1_REQUEST } from "@/data/writing-task1-request";
import { WRITING_TASK2_REQUEST } from "@/data/writing-task2-request";
import { aihubErrorMessage } from "@/data/aihub-contract/error-code-policy";

/** The client budget. The real 90s, not a simulated delay. */
export const CLIENT_BUDGET_SECONDS = 90;

export type PublicError = {
  code: string;
  message: string;
  retryable?: boolean;
  retry_after_ms?: number;
};

/**
 * Which colour scale a criterion wears. The four rubric slots map onto the
 * shared criterion tokens; Task Achievement and Task Response are the same slot
 * and deliberately share one colour.
 */
const CRITERION_TONE: Record<string, string> = {
  task_achievement: "achieve",
  task_response: "achieve",
  coherence_cohesion: "coherence",
  lexical_resource: "lexical",
  grammatical_range_accuracy: "grammar",
};

export function toneFor(criterionId: string) {
  return CRITERION_TONE[criterionId] ?? "achieve";
}

/**
 * `issue` is a free string the downstream varies per run, not an enum from any
 * fixed list in this repository. It is rendered as the string it is.
 */
export function errorFromPayload(payload: unknown): PublicError {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "code" in payload.error &&
    "message" in payload.error &&
    typeof payload.error.code === "string" &&
    typeof payload.error.message === "string"
  ) {
    const error = payload.error as {
      retryable?: unknown;
      retry_after_ms?: unknown;
    };
    return {
      code: payload.error.code,
      message: aihubErrorMessage(payload.error.code),
      ...(typeof error.retryable === "boolean"
        ? { retryable: error.retryable }
        : {}),
      ...(typeof error.retry_after_ms === "number"
        ? { retry_after_ms: error.retry_after_ms }
        : {}),
    };
  }
  return {
    code: "AI_SERVICE_UNAVAILABLE",
    message: "Không đọc được kết quả. Thử lại sau nhé.",
  };
}

/**
 * One draft per task. Each task's sample prefills its own fields, so a shared
 * `question`/`essay` would show Task 1's essay on the Task 2 tab — and a
 * switch must not discard the other task's typing either.
 */
export type Draft = {
  question: string;
  essay: string;
  chartType?: string;
  imageUrl?: string;
  topic?: string;
};

export const SAMPLE_DRAFT: Record<1 | 2, Draft> = {
  1: {
    question: WRITING_TASK1_REQUEST.question,
    essay: WRITING_TASK1_REQUEST.essay,
    chartType: WRITING_TASK1_REQUEST.chart_type,
    imageUrl: WRITING_TASK1_REQUEST.image_url,
  },
  2: {
    question: WRITING_TASK2_REQUEST.question,
    essay: WRITING_TASK2_REQUEST.essay,
    topic: WRITING_TASK2_REQUEST.topic,
  },
};
