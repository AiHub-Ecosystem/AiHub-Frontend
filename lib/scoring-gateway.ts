import { randomUUID } from "node:crypto";

import {
  isFetchableImageUrl,
  WRITING_TASK1_CHART_TYPES,
} from "@/data/writing-task1-request";
import {
  parseWritingGradingEnvelope,
  type WritingGradingEnvelope,
} from "@/data/scoring-response";
import {
  isSameOrigin,
  mintSandboxAssertion,
  resolveSandboxConfig,
  SandboxBoundaryError,
} from "@/lib/sandbox-gateway";

/**
 * Gateway for the public Writing grading demo.
 *
 * The sandbox transport — host pinning, env resolution, same-origin — is
 * shared with Speaking in `lib/sandbox-gateway.ts`. What stays here is the
 * Writing contract: two task schemas, their field limits, and the idempotency
 * key every submission carries.
 */

/** The endpoint's own limits, verified against the backend schemas. */
const MAX_JSON_BYTES = 256 * 1024;
const MAX_QUESTION_CHARS = 2_000;
const MAX_ESSAY_CHARS = 20_000;
const MAX_TOPIC_CHARS = 200;

const CHART_TYPES = new Set<string>(WRITING_TASK1_CHART_TYPES);

const ALLOWED_FIELDS: Record<1 | 2, Set<string>> = {
  1: new Set(["task", "question", "essay", "chart_type", "image_url"]),
  2: new Set(["task", "question", "essay", "topic"]),
};

export type WritingTask = 1 | 2;

export type WritingErrorCode =
  | "INVALID_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "AI_SERVICE_ERROR"
  | "AI_SERVICE_CONTRACT_VIOLATION"
  | "AI_SERVICE_THROTTLED"
  | "AI_SERVICE_UNAVAILABLE"
  | "AI_SERVICE_TIMEOUT";

export class ScoringBoundaryError extends Error {
  constructor(readonly code: WritingErrorCode) {
    super(code);
    this.name = "ScoringBoundaryError";
  }
}

export type WritingRequest = {
  task: WritingTask;
  question: string;
  essay: string;
  chartType?: string;
  imageUrl?: string;
  topic?: string;
};

/**
 * An upstream failure keeps its code, its `retryable` flag and its
 * `retry_after_ms`. `RATE_LIMITED`, `QUOTA_EXCEEDED` and `FORBIDDEN` are
 * different problems and a visitor has to be able to tell them apart; only the
 * message is replaced, with text written here.
 */
export class ScoringUpstreamError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly retryable: boolean,
    // Kept in the upstream spelling: it reaches the client verbatim, and
    // renaming it here would make the demo's error payload a second dialect.
    readonly retry_after_ms?: number
  ) {
    super(code);
    this.name = "ScoringUpstreamError";
  }
}

function invalidRequest() {
  return new ScoringBoundaryError("INVALID_REQUEST");
}

function getSandboxConfig() {
  try {
    return resolveSandboxConfig();
  } catch (error) {
    if (error instanceof SandboxBoundaryError) {
      throw new ScoringBoundaryError("AI_SERVICE_UNAVAILABLE");
    }
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  if (!value.trim() || value.length > maxChars) return null;
  return value;
}

export async function parseWritingRequest(
  request: Request
): Promise<WritingRequest> {
  if (!isSameOrigin(request)) throw invalidRequest();

  // Measured on the raw text before parsing, so an oversized body is rejected
  // without ever being parsed.
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    throw invalidRequest();
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BYTES) {
    throw new ScoringBoundaryError("PAYLOAD_TOO_LARGE");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw invalidRequest();
  }
  if (!isRecord(body)) throw invalidRequest();

  const task = body.task;
  if (task !== 1 && task !== 2) throw invalidRequest();
  if (Object.keys(body).some((key) => !ALLOWED_FIELDS[task].has(key))) {
    throw invalidRequest();
  }

  const question = requiredText(body.question, MAX_QUESTION_CHARS);
  if (question === null) throw invalidRequest();

  const essay = requiredText(body.essay, MAX_ESSAY_CHARS);
  if (essay === null) throw invalidRequest();

  if (task === 2) {
    const topic = requiredText(body.topic, MAX_TOPIC_CHARS);
    if (topic === null) throw invalidRequest();
    return { task, question, essay, topic };
  }

  const chartType = body.chart_type;
  if (typeof chartType !== "string" || !CHART_TYPES.has(chartType)) {
    throw invalidRequest();
  }

  const imageUrl = body.image_url;
  if (typeof imageUrl !== "string" || !isFetchableImageUrl(imageUrl)) {
    throw invalidRequest();
  }

  return { task, question, essay, chartType, imageUrl };
}

/**
 * Upstream wire format is snake_case. The remap happens here, never in the
 * component.
 */
function toUpstreamBody(input: WritingRequest) {
  if (input.task === 2) {
    return {
      question: input.question,
      essay: input.essay,
      topic: input.topic as string,
    };
  }
  return {
    question: input.question,
    essay: input.essay,
    chart_type: input.chartType as string,
    image_url: input.imageUrl as string,
  };
}

function readUpstreamError(payload: unknown, status: number) {
  const code =
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "code" in payload.error &&
    typeof payload.error.code === "string"
      ? payload.error.code
      : null;

  if (!code) {
    throw new ScoringBoundaryError(
      status === 413
        ? "PAYLOAD_TOO_LARGE"
        : status === 429
          ? "AI_SERVICE_THROTTLED"
          : status === 504
            ? "AI_SERVICE_TIMEOUT"
            : status === 503
              ? "AI_SERVICE_UNAVAILABLE"
              : "AI_SERVICE_ERROR"
    );
  }

  const error = payload as {
    error: { retryable?: unknown; retry_after_ms?: unknown };
  };
  return new ScoringUpstreamError(
    code,
    status,
    error.error.retryable === true,
    typeof error.error.retry_after_ms === "number"
      ? error.error.retry_after_ms
      : undefined
  );
}

export async function gradeWriting(
  request: Request,
  requestId: string
): Promise<WritingGradingEnvelope> {
  const input = await parseWritingRequest(request);
  const { baseUrl, apiKey } = getSandboxConfig();
  const assertion = await mintSandboxAssertion(baseUrl, apiKey);

  // Minted here rather than taken from the browser. The demo page is a reader,
  // not an integration: a visitor has no key and a hex string in the form
  // teaches a detail about a server they do not run. A UUID satisfies the
  // gateway's own 1-255 byte rule by construction. Pressing the button twice is
  // two paid grades, never a replay, which is why the demo never retries — a
  // retry that re-keys is a second charge, and one that does not is a replay.
  const idempotencyKey = randomUUID();

  const controller = new AbortController();
  // The upstream budget is 60s and this route's maxDuration is 90s, so abort
  // upstream well inside that: a transport that stalls must leave enough
  // budget for the AI_SERVICE_TIMEOUT response to be written back, rather than
  // racing the platform that enforces maxDuration.
  const timeout = setTimeout(() => controller.abort("scoring-timeout"), 65_000);
  const abortRequest = () => controller.abort("request-aborted");
  request.signal.addEventListener("abort", abortRequest, { once: true });

  let response: Response;
  try {
    response = await fetch(
      `${baseUrl}/v1/ielts/writing/task${input.task}/grade`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          // A Signed User Assertion, minted for the same declared user id
          // Speaking uses. An Organization with an active identity configuration
          // rejects a declared id outright rather than falling back, so this is
          // the only shape that works whether or not that configuration exists.
          "X-User-Identity": assertion,
          "X-Correlation-Id": requestId,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(toUpstreamBody(input)),
        cache: "no-store",
        signal: controller.signal,
      }
    );
  } catch {
    if (controller.signal.reason === "scoring-timeout") {
      throw new ScoringBoundaryError("AI_SERVICE_TIMEOUT");
    }
    throw new ScoringBoundaryError("AI_SERVICE_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortRequest);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) throw readUpstreamError(null, response.status);
    throw new ScoringBoundaryError("AI_SERVICE_CONTRACT_VIOLATION");
  }
  if (!response.ok) throw readUpstreamError(payload, response.status);

  const parsed = parseWritingGradingEnvelope(payload);
  if (!parsed) throw new ScoringBoundaryError("AI_SERVICE_CONTRACT_VIOLATION");

  return {
    data: parsed.data,
    meta: {
      request_id: requestId,
      correlation_id: requestId,
      service: "writing",
      operation: `writing.task${input.task}.grade`,
    },
  };
}
