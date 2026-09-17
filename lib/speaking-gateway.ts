import { createHash, randomUUID } from "node:crypto";
import { MAX_SPEAKING_BYTES } from "@/data/speaking-contract";
import { SPEAKING_PROMPTS } from "@/data/speaking-prompts";
import {
  parseSpeakingGradingEnvelope,
  type SpeakingGradingEnvelope,
} from "@/data/speaking-response";

const MAX_TEXT_BYTES = 64 * 1024;
const ALLOWED_EXTENSIONS = new Set(["wav", "mp3", "m4a", "webm", "ogg"]);
const ALLOWED_FIELDS = new Set(["audio", "part", "question_id", "prompt_text", "test_type"]);
const INTERNAL_USER_ID = `cu_${createHash("sha256")
  .update("aihub-internal\0speaking-demo", "utf8")
  .digest("base64url")}`;

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

type SpeakingRequest = {
  audio: File;
  part: number;
  questionId: string;
  promptText: string;
};

function invalidRequest() {
  return new SpeakingBoundaryError("INVALID_REQUEST");
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new SpeakingBoundaryError("AI_SERVICE_UNAVAILABLE");
  return value;
}

function getSandboxConfig() {
  const rawBaseUrl = required("AIHUB_SANDBOX_BASE_URL").replace(/\/+$/, "");
  const apiKey = required("AIHUB_SANDBOX_API_KEY");
  required("AIHUB_SANDBOX_ORGANIZATION_ID");

  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    throw new SpeakingBoundaryError("AI_SERVICE_UNAVAILABLE");
  }

  if (
    baseUrl.protocol !== "https:" ||
    baseUrl.hostname.toLowerCase() !== "sandbox.aihubproduction.com" ||
    baseUrl.port ||
    baseUrl.pathname !== "/" ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new SpeakingBoundaryError("AI_SERVICE_UNAVAILABLE");
  }

  return { baseUrl: rawBaseUrl, apiKey };
}

function getSingleText(form: FormData, key: string, maxLength = MAX_TEXT_BYTES) {
  const values = form.getAll(key);
  if (values.length > 1 || (values[0] !== undefined && typeof values[0] !== "string")) {
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
  const origin = request.headers.get("origin");
  if (!origin) return;

  try {
    const requestUrl = new URL(request.url);
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProto || requestUrl.protocol.slice(0, -1);
    const host = request.headers.get("host") || requestUrl.host;
    const effectiveOrigin = new URL(`${protocol}://${host}`).origin;
    if (new URL(origin).origin !== effectiveOrigin) throw invalidRequest();
  } catch (error) {
    if (error instanceof SpeakingBoundaryError) throw error;
    throw invalidRequest();
  }
}

export async function parseSpeakingRequest(request: Request): Promise<SpeakingRequest> {
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
  if ([...counts.keys()].some((key) => !ALLOWED_FIELDS.has(key))) throw invalidRequest();

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
  if (audio.size > MAX_SPEAKING_BYTES) throw new SpeakingBoundaryError("PAYLOAD_TOO_LARGE");

  const extension = audio.name.toLowerCase().split(".").pop();
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) throw invalidRequest();

  const partValue = getSingleText(form, "part", 8);
  const part = Number(partValue);
  if (!partValue || !Number.isInteger(part) || part < 1 || part > 3) throw invalidRequest();

  const questionId = getSingleText(form, "question_id", 256);
  if (!questionId) throw invalidRequest();
  const promptText = getSingleText(form, "prompt_text");
  const testType = getSingleText(form, "test_type", 32);
  if (testType !== undefined && testType !== "Practice") throw invalidRequest();

  const prompt = SPEAKING_PROMPTS.find((item) => item.id === questionId);
  if (!prompt || prompt.part !== part || (promptText !== undefined && promptText !== prompt.question)) {
    throw invalidRequest();
  }

  return { audio, part, questionId, promptText: prompt.question };
}

function toUpstreamForm(request: SpeakingRequest) {
  const form = new FormData();
  form.append("audio", request.audio, request.audio.name);
  form.append("part", String(request.part));
  form.append("question_id", request.questionId);
  form.append("prompt_text", request.promptText);
  form.append("test_type", "Practice");
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
  if (status === 503) return new SpeakingBoundaryError("AI_SERVICE_UNAVAILABLE");
  if (status === 504) return new SpeakingBoundaryError("AI_SERVICE_TIMEOUT");
  return new SpeakingBoundaryError("AI_SERVICE_ERROR");
}

export async function gradeSpeaking(request: Request, requestId = `req_${randomUUID()}`): Promise<SpeakingGradingEnvelope> {
  const input = await parseSpeakingRequest(request);
  const { baseUrl, apiKey } = getSandboxConfig();
  const assertion = await mintSandboxAssertion(apiKey, baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("speaking-timeout"), 90_000);
  const abortRequest = () => controller.abort("request-aborted");
  request.signal.addEventListener("abort", abortRequest, { once: true });

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/ielts/speaking/grading`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "X-API-Key": apiKey,
        "X-User-Assertion": assertion,
        "X-Correlation-Id": requestId,
      },
      body: toUpstreamForm(input),
      cache: "no-store",
      signal: controller.signal,
    });
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
      operation: "speaking.grading",
    },
  };
}
