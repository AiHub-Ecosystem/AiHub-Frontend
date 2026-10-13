import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  DemoCredentialError,
  isSameOrigin,
  readDemoApiKey,
  resolveSandboxBaseUrl,
  SandboxBoundaryError,
} from "@/lib/sandbox-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Scope = "writing.grade" | "speaking.grade";

function noStore(payload: unknown, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorMessage(code: string) {
  switch (code) {
    case "UNAUTHORIZED":
      return "API key không hợp lệ, đã hết hạn hoặc đã bị thu hồi.";
    case "ENVIRONMENT_NOT_ALLOWED":
      return "Chỉ chấp nhận API key được giới hạn riêng cho môi trường Sandbox.";
    case "FORBIDDEN":
      return "Key thiếu scope cần thiết hoặc Organization đang bật Identity Configuration.";
    case "RATE_LIMITED":
      return "Bạn kiểm tra key quá nhanh. Chờ một chút rồi thử lại.";
    default:
      return "Không thể kiểm tra key lúc này. Thử lại sau.";
  }
}

export async function POST(request: Request) {
  const requestId = `req_${randomUUID()}`;
  if (!isSameOrigin(request)) {
    return noStore(
      { error: { code: "INVALID_REQUEST", message: "Yêu cầu không hợp lệ." }, meta: { request_id: requestId } },
      400,
    );
  }

  let scope: Scope;
  let apiKey: string;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 1024) throw new Error();
    const body: unknown = JSON.parse(raw);
    if (
      typeof body !== "object" ||
      body === null ||
      !("scope" in body) ||
      (body.scope !== "writing.grade" && body.scope !== "speaking.grade")
    ) {
      throw new Error();
    }
    scope = body.scope;
    apiKey = readDemoApiKey(request);
  } catch (error) {
    const code = error instanceof DemoCredentialError ? error.code : "INVALID_REQUEST";
    return noStore(
      { error: { code, message: code === "UNAUTHORIZED" ? errorMessage(code) : "Scope hoặc nội dung kiểm tra không hợp lệ." }, meta: { request_id: requestId } },
      code === "UNAUTHORIZED" ? 401 : 400,
    );
  }

  let baseUrl: string;
  try {
    baseUrl = resolveSandboxBaseUrl();
  } catch (error) {
    if (!(error instanceof SandboxBoundaryError)) throw error;
    return noStore(
      { error: { code: "AI_SERVICE_UNAVAILABLE", message: "Sandbox tạm thời không truy cập được." }, meta: { request_id: requestId } },
      503,
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
      },
      body: JSON.stringify({ scope }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return noStore(
      { error: { code: "AI_SERVICE_UNAVAILABLE", message: "Sandbox tạm thời không truy cập được." }, meta: { request_id: requestId } },
      503,
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
      "environment" in payload.data &&
      payload.data.environment === "sandbox" &&
      "scope" in payload.data &&
      payload.data.scope === scope
    ) {
      return noStore(payload, 200);
    }
    return noStore(
      { error: { code: "AI_SERVICE_CONTRACT_VIOLATION", message: "Sandbox trả về response không đúng định dạng." }, meta: { request_id: requestId } },
      502,
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
    upstreamError && "code" in upstreamError && typeof upstreamError.code === "string"
      ? upstreamError.code
      : "AI_SERVICE_UNAVAILABLE";
  const retryable =
    upstreamError && "retryable" in upstreamError && upstreamError.retryable === true;
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
        message: errorMessage(code),
        ...(retryable ? { retryable: true } : {}),
        ...(retryAfter === undefined ? {} : { retry_after_ms: retryAfter }),
      },
      meta: { request_id: requestId },
    },
    response.status,
  );
}
