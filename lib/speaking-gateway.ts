import { randomUUID } from "node:crypto";
import { MAX_SPEAKING_BYTES } from "@/data/speaking-contract";
import {
  parseSpeakingGradingEnvelope,
  type SpeakingGradingEnvelope,
} from "@/data/speaking-response";
import {
  INTERNAL_USER_ID,
  isSameOrigin,
  resolveSandboxBaseUrl,
  resolveSandboxConfig,
  SandboxBoundaryError,
} from "@/lib/sandbox-gateway";

const MAX_TEXT_BYTES = 64 * 1024;
const MAX_JSON_BYTES = 256 * 1024;
const ALLOWED_EXTENSIONS = new Set(["wav", "mp3", "m4a", "webm", "ogg"]);
const ALLOWED_FIELDS = new Set([
  "audio",
  "part",
  "question_id",
  "prompt_text",
  "test_type",
  "test_code",
  "transcript",
]);
const ALLOWED_JSON_FIELDS = new Set([
  "audio_url",
  "part",
  "question_id",
  "prompt_text",
  "test_type",
  "test_code",
  "transcript",
]);
const SPEAKING_AUDIO_URL_HOST = "s3.wispace.app";

export type SpeakingErrorCode =
  | "INVALID_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "AI_SERVICE_ERROR"
  | "AI_SERVICE_CONTRACT_VIOLATION"
  | "AI_SERVICE_THROTTLED"
  | "AI_SERVICE_UNAVAILABLE"
  | "AI_SERVICE_TIMEOUT";

export class SpeakingBoundaryError extends Error {
  constructor(readonly code: SpeakingErrorCode) {
    super(code);
    this.name = "SpeakingBoundaryError";
  }
}

/** The contract fixes the test type to these two values; it defaults to Practice. */
const TEST_TYPES = new Set(["Practice", "Full-test"]);

type SpeakingRequest = {
  audio: File;
  part: number;
  questionId: string;
  promptText?: string;
  testType?: string;
  testCode?: string;
  transcript?: string;
};

type SpeakingJsonRequest = {
  audioUrl: string;
  part: number;
  questionId: string;
  promptText?: string | null;
  testType?: string | null;
  testCode?: string | null;
  transcript?: string | null;
};

function invalidRequest() {
  return new SpeakingBoundaryError("INVALID_REQUEST");
}

/**
 * The host allowlist lives in the shared transport. Speaking keeps its own
 * signature so callers — and the gateway's tests — keep seeing a Speaking
 * boundary error when the sandbox is not configured.
 */
export function getSandboxBaseUrl() {
  try {
    return resolveSandboxBaseUrl();
  } catch (error) {
    if (error instanceof SandboxBoundaryError) {
      throw new SpeakingBoundaryError("AI_SERVICE_UNAVAILABLE");
    }
    throw error;
  }
}

function getSandboxConfig() {
  try {
    return resolveSandboxConfig();
  } catch (error) {
    if (error instanceof SandboxBoundaryError) {
      throw new SpeakingBoundaryError("AI_SERVICE_UNAVAILABLE");
    }
    throw error;
  }
}

function getSingleText(
  form: FormData,
  key: string,
  maxLength = MAX_TEXT_BYTES
) {
  const values = form.getAll(key);
  if (
    values.length > 1 ||
    (values[0] !== undefined && typeof values[0] !== "string")
  ) {
    throw invalidRequest();
  }
  const value = values[0];
  if (value === undefined) return undefined;
  if (!value.trim() || new TextEncoder().encode(value).byteLength > maxLength) {
    throw invalidRequest();
  }
  return value;
}

function assertSameOrigin(request: Request) {
  if (!isSameOrigin(request)) throw invalidRequest();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isApprovedSpeakingAudioUrl(value: string) {
  if (value.length === 0 || value.length > 2_048 || /\s/.test(value))
    return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === SPEAKING_AUDIO_URL_HOST &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

function optionalJsonText(
  body: Record<string, unknown>,
  key: string,
  maxLength = MAX_TEXT_BYTES
): string | null | undefined {
  const value = body[key];
  if (value === undefined || value === null) return value;
  if (
    typeof value !== "string" ||
    !value.trim() ||
    new TextEncoder().encode(value).byteLength > maxLength
  ) {
    throw invalidRequest();
  }
  return value;
}

export async function parseSpeakingRequest(
  request: Request
): Promise<SpeakingRequest> {
  assertSameOrigin(request);
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_SPEAKING_BYTES) {
    throw new SpeakingBoundaryError("PAYLOAD_TOO_LARGE");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw invalidRequest();
  }

  const counts = new Map<string, number>();
  for (const key of form.keys()) counts.set(key, (counts.get(key) ?? 0) + 1);
  if ([...counts.keys()].some((key) => !ALLOWED_FIELDS.has(key)))
    throw invalidRequest();

  const audioValues = form.getAll("audio");
  const audio = audioValues[0];
  if (
    audioValues.length !== 1 ||
    !audio ||
    typeof audio !== "object" ||
    typeof (audio as File).arrayBuffer !== "function" ||
    typeof (audio as File).name !== "string"
  ) {
    throw invalidRequest();
  }
  if (audio.size < 100) throw invalidRequest();
  if (audio.size > MAX_SPEAKING_BYTES)
    throw new SpeakingBoundaryError("PAYLOAD_TOO_LARGE");

  const extension = audio.name.toLowerCase().split(".").pop();
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) throw invalidRequest();

  const partValue = getSingleText(form, "part", 8);
  const part = Number(partValue);
  if (!partValue || !Number.isInteger(part) || part < 1 || part > 3)
    throw invalidRequest();

  // The contract fixes no upper length on the question id, only a non-empty
  // one. The demo keeps the general text bound so a long id is still bounded
  // before dispatch; that bound is ours, not the contract's.
  const questionId = getSingleText(form, "question_id");
  if (!questionId) throw invalidRequest();
  const promptText = getSingleText(form, "prompt_text");
  const testType = getSingleText(form, "test_type");
  if (testType !== undefined && !TEST_TYPES.has(testType))
    throw invalidRequest();
  const testCode = getSingleText(form, "test_code");
  const transcript = getSingleText(form, "transcript");

  return {
    audio,
    part,
    questionId,
    ...(promptText === undefined ? {} : { promptText }),
    ...(testType === undefined ? {} : { testType }),
    ...(testCode === undefined ? {} : { testCode }),
    ...(transcript === undefined ? {} : { transcript }),
  };
}

export async function parseSpeakingJsonRequest(
  request: Request
): Promise<SpeakingJsonRequest> {
  assertSameOrigin(request);
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    throw new SpeakingBoundaryError("PAYLOAD_TOO_LARGE");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw invalidRequest();
  }
  if (
    !isRecord(body) ||
    Object.keys(body).some((key) => !ALLOWED_JSON_FIELDS.has(key))
  ) {
    throw invalidRequest();
  }

  const audioUrl = body.audio_url;
  if (typeof audioUrl !== "string" || !isApprovedSpeakingAudioUrl(audioUrl)) {
    throw invalidRequest();
  }
  const part = body.part;
  if (
    typeof part !== "number" ||
    !Number.isInteger(part) ||
    part < 1 ||
    part > 3
  ) {
    throw invalidRequest();
  }
  const questionId = body.question_id;
  if (
    typeof questionId !== "string" ||
    !questionId.trim() ||
    questionId.length > MAX_TEXT_BYTES
  ) {
    throw invalidRequest();
  }
  const promptText = optionalJsonText(body, "prompt_text");
  const testType = optionalJsonText(body, "test_type");
  if (testType !== undefined && testType !== null && !TEST_TYPES.has(testType))
    throw invalidRequest();
  const testCode = optionalJsonText(body, "test_code");
  const transcript = optionalJsonText(body, "transcript");

  return {
    audioUrl,
    part,
    questionId,
    ...(promptText === undefined ? {} : { promptText }),
    ...(testType === undefined ? {} : { testType }),
    ...(testCode === undefined ? {} : { testCode }),
    ...(transcript === undefined ? {} : { transcript }),
  };
}

function toUpstreamForm(request: SpeakingRequest) {
  const form = new FormData();
  form.append("audio", request.audio, request.audio.name);
  form.append("part", String(request.part));
  form.append("question_id", request.questionId);
  if (request.promptText !== undefined)
    form.append("prompt_text", request.promptText);
  form.append("test_type", request.testType ?? "Practice");
  if (request.testCode !== undefined)
    form.append("test_code", request.testCode);
  if (request.transcript !== undefined)
    form.append("transcript", request.transcript);
  return form;
}

async function mintSandboxAssertion(apiKey: string, baseUrl: string) {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/sandbox/assertions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ user_id: INTERNAL_USER_ID }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new SpeakingBoundaryError("AI_SERVICE_UNAVAILABLE");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new SpeakingBoundaryError("AI_SERVICE_UNAVAILABLE");
  }

  if (
    !response.ok ||
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload) ||
    typeof payload.data !== "object" ||
    payload.data === null ||
    !("assertion" in payload.data) ||
    typeof payload.data.assertion !== "string" ||
    !payload.data.assertion.trim()
  ) {
    throw new SpeakingBoundaryError("AI_SERVICE_UNAVAILABLE");
  }

  return payload.data.assertion;
}

function upstreamError(status: number) {
  if (status === 413) return new SpeakingBoundaryError("PAYLOAD_TOO_LARGE");
  if (status === 429) return new SpeakingBoundaryError("AI_SERVICE_THROTTLED");
  if (status === 503)
    return new SpeakingBoundaryError("AI_SERVICE_UNAVAILABLE");
  if (status === 504) return new SpeakingBoundaryError("AI_SERVICE_TIMEOUT");
  return new SpeakingBoundaryError("AI_SERVICE_ERROR");
}

async function callSpeakingGrading(
  request: Request,
  requestId: string,
  operation: "speaking.grading" | "speaking.grading-json",
  body: FormData | string
): Promise<SpeakingGradingEnvelope> {
  const { baseUrl, apiKey } = getSandboxConfig();
  const assertion = await mintSandboxAssertion(apiKey, baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort("speaking-timeout"),
    90_000
  );
  const abortRequest = () => controller.abort("request-aborted");
  request.signal.addEventListener("abort", abortRequest, { once: true });

  let response: Response;
  try {
    response = await fetch(
      `${baseUrl}/v1/ielts/speaking/${operation === "speaking.grading" ? "grading" : "grading-json"}`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-API-Key": apiKey,
          "X-User-Identity": assertion,
          "X-Correlation-Id": requestId,
          ...(operation === "speaking.grading-json"
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body,
        cache: "no-store",
        signal: controller.signal,
      }
    );
  } catch (error) {
    if (controller.signal.reason === "speaking-timeout") {
      throw new SpeakingBoundaryError("AI_SERVICE_TIMEOUT");
    }
    if (error instanceof SpeakingBoundaryError) throw error;
    throw new SpeakingBoundaryError("AI_SERVICE_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortRequest);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) throw upstreamError(response.status);
    throw new SpeakingBoundaryError("AI_SERVICE_CONTRACT_VIOLATION");
  }
  if (!response.ok) throw upstreamError(response.status);

  const parsed = parseSpeakingGradingEnvelope(payload);
  if (!parsed) throw new SpeakingBoundaryError("AI_SERVICE_CONTRACT_VIOLATION");

  return {
    data: parsed.data,
    meta: {
      request_id: requestId,
      correlation_id: requestId,
      service: "speaking",
      operation,
    },
  };
}

export async function gradeSpeaking(
  request: Request,
  requestId = `req_${randomUUID()}`
): Promise<SpeakingGradingEnvelope> {
  const input = await parseSpeakingRequest(request);
  return callSpeakingGrading(
    request,
    requestId,
    "speaking.grading",
    toUpstreamForm(input)
  );
}

export async function gradeSpeakingByUrl(
  request: Request,
  requestId = `req_${randomUUID()}`
): Promise<SpeakingGradingEnvelope> {
  const input = await parseSpeakingJsonRequest(request);
  return callSpeakingGrading(
    request,
    requestId,
    "speaking.grading-json",
    JSON.stringify({
      audio_url: input.audioUrl,
      part: input.part,
      question_id: input.questionId,
      ...(input.promptText === undefined
        ? {}
        : { prompt_text: input.promptText }),
      test_type: input.testType ?? "Practice",
      ...(input.testCode === undefined || input.testCode === null
        ? {}
        : { test_code: input.testCode }),
      ...(input.transcript === undefined || input.transcript === null
        ? {}
        : { transcript: input.transcript }),
    })
  );
}
