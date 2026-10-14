import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import type { DemoEnvironment } from "@/lib/demo-environments";
import type { DemoScope } from "@/lib/demo-environments";
import {
  DemoBoundaryError,
  DemoCredentialError,
  demoBffHeaders,
  isDemoEnvironment,
  isSameOrigin,
  readDemoApiKey,
  resolveDemoBaseUrl,
} from "@/lib/demo-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 1024;

class DemoPayloadTooLargeError extends Error {}

async function readBoundedBody(request: Request): Promise<string> {
  const rawLength = request.headers.get("content-length");
  if (rawLength !== null) {
    const contentLength = Number(rawLength);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0)
      throw new Error("invalid-content-length");
    if (contentLength > MAX_BODY_BYTES) throw new DemoPayloadTooLargeError();
  }

  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new DemoPayloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function noStore(payload: unknown, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorMessage(code: string, environment?: DemoEnvironment) {
  switch (code) {
    case "UNAUTHORIZED":
      return "API key không hợp lệ, đã hết hạn hoặc đã bị thu hồi.";
    case "ENVIRONMENT_NOT_ALLOWED":
      return `Key này không được phép dùng cho môi trường ${environment ?? "đã chọn"}.`;
    case "FORBIDDEN":
      // The backend intentionally uses one denial for these cases; don't claim
      // to know which one happened.
      return `Không thể dùng mã API này cho bản thử. Hãy kiểm tra đúng môi trường và quyền chấm của key. Nếu tổ chức yêu cầu mã người dùng có chữ ký từ máy chủ, bản thử chưa hỗ trợ; đăng nhập hoặc nhập ID thường không thay thế được chữ ký đó. Hãy gửi yêu cầu từ máy chủ của bạn.`;
    case "RATE_LIMITED":
      return "Bạn kiểm tra key quá nhanh. Chờ một chút rồi thử lại.";
    case "PAYLOAD_TOO_LARGE":
      return "Nội dung kiểm tra vượt quá 1 KB.";
    default:
      return "Không thể kiểm tra key lúc này. Thử lại sau.";
  }
}

export async function POST(request: Request) {
  const requestId = `req_${randomUUID()}`;
  if (!isSameOrigin(request)) {
    return noStore(
      {
        error: { code: "INVALID_REQUEST", message: "Yêu cầu không hợp lệ." },
        meta: { request_id: requestId },
      },
      400
    );
  }

  let scope: DemoScope;
  let environment: DemoEnvironment;
  let apiKey: string;
  try {
    const raw = await readBoundedBody(request);
    const body: unknown = JSON.parse(raw);
    if (
      typeof body !== "object" ||
      body === null ||
      !("scope" in body) ||
      (body.scope !== "writing.grade" && body.scope !== "speaking.grade") ||
      !isDemoEnvironment(
        "environment" in body ? (body.environment as string) : undefined
      )
    ) {
      throw new Error();
    }
    scope = body.scope;
    environment = (body as unknown as { environment: "sandbox" | "production" })
      .environment;
    apiKey = readDemoApiKey(request);
  } catch (error) {
    const code =
      error instanceof DemoCredentialError
        ? error.code
        : error instanceof DemoPayloadTooLargeError
          ? "PAYLOAD_TOO_LARGE"
          : "INVALID_REQUEST";
    return noStore(
      {
        error: {
          code,
          message:
            code === "UNAUTHORIZED"
              ? errorMessage(code)
              : "Môi trường, scope hoặc nội dung kiểm tra không hợp lệ.",
        },
        meta: { request_id: requestId },
      },
      code === "UNAUTHORIZED" ? 401 : code === "PAYLOAD_TOO_LARGE" ? 413 : 400
    );
  }

  let baseUrl: string;
  try {
    baseUrl = resolveDemoBaseUrl(environment);
  } catch (error) {
    if (!(error instanceof DemoBoundaryError)) throw error;
    return noStore(
      {
        error: {
          code: "AI_SERVICE_UNAVAILABLE",
          message: "Môi trường demo tạm thời không truy cập được.",
        },
        meta: { request_id: requestId },
      },
      503
    );
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/sandbox/demo/api-keys/validate`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "X-Correlation-Id": requestId,
        ...demoBffHeaders(request),
      },
      body: JSON.stringify({ environment, scope }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return noStore(
      {
        error: {
          code: "AI_SERVICE_UNAVAILABLE",
          message: "Môi trường demo tạm thời không truy cập được.",
        },
        meta: { request_id: requestId },
      },
      503
    );
  }

  const payload: unknown = await response.json().catch(() => null);
  if (response.ok) {
    if (
      typeof payload === "object" &&
      payload !== null &&
      "data" in payload &&
      typeof payload.data === "object" &&
      payload.data !== null &&
      "valid" in payload.data &&
      payload.data.valid === true &&
      // The answer must be about the tier the demo asked about; a response for
      // the other one is a mismatch the visitor has to see, not absorb.
      "environment" in payload.data &&
      payload.data.environment === environment &&
      "scope" in payload.data &&
      payload.data.scope === scope
    ) {
      // The allowance snapshot rides inside `data` exactly as the backend sends
      // it: advisory, and re-checked by every grade.
      return noStore(payload, 200);
    }
    return noStore(
      {
        error: {
          code: "AI_SERVICE_CONTRACT_VIOLATION",
          message: "AIHUB trả về response không đúng định dạng.",
        },
        meta: { request_id: requestId },
      },
      502
    );
  }

  const upstreamError =
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null
      ? payload.error
      : null;
  const code =
    upstreamError &&
    "code" in upstreamError &&
    typeof upstreamError.code === "string"
      ? upstreamError.code
      : "AI_SERVICE_UNAVAILABLE";
  const retryable =
    upstreamError &&
    "retryable" in upstreamError &&
    upstreamError.retryable === true;
  const retryAfter =
    upstreamError &&
    "retry_after_ms" in upstreamError &&
    typeof upstreamError.retry_after_ms === "number"
      ? upstreamError.retry_after_ms
      : undefined;
  return noStore(
    {
      error: {
        code,
        message: errorMessage(code, environment),
        ...(retryable ? { retryable: true } : {}),
        ...(retryAfter === undefined ? {} : { retry_after_ms: retryAfter }),
      },
      meta: { request_id: requestId },
    },
    response.status
  );
}
