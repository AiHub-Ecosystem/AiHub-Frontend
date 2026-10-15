import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isFetchableImageUrl } from "@/data/writing-task1-request";
import {
  DemoBoundaryError,
  DemoCredentialError,
  demoBffHeaders,
  isDemoEnvironment,
  isSameOrigin,
  readDemoApiKey,
  readDemoEnvironment,
  readDemoUserIdentity,
  resolveDemoBaseUrl,
} from "@/lib/demo-gateway";

const MAX_CHART_BYTES = 10 * 1024 * 1024;
const ASSET_ID = /^chart_[0-9A-HJKMNP-TV-Z]{26}$/;
const CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const UPSTREAM_MESSAGES: Record<string, string> = {
  INVALID_REQUEST: "Ảnh hoặc yêu cầu tải lên không hợp lệ.",
  PAYLOAD_TOO_LARGE: "Ảnh vượt quá giới hạn 10 MiB.",
  UNAUTHORIZED: "API key không hợp lệ hoặc đã hết hạn.",
  INVALID_USER_IDENTITY:
    "Mã người dùng không hợp lệ hoặc không đúng cấu hình của Organization.",
  USER_IDENTITY_REQUIRED: "Cần có mã người dùng để tải ảnh lên.",
  FORBIDDEN: "API key cần có scope writing.grade để tải ảnh lên.",
  NOT_FOUND: "Lượt tải lên đã hết hạn hoặc không thuộc người dùng hiện tại.",
  RATE_LIMITED:
    "Organization đã đạt giới hạn tải ảnh. Hãy thử lại sau một giờ.",
  WRITING_CHART_STORAGE_UNAVAILABLE:
    "Kho ảnh biểu đồ hiện chưa sẵn sàng. Vui lòng thử lại sau.",
  INTERNAL_ERROR: "Không thể hoàn tất yêu cầu tải ảnh. Vui lòng thử lại sau.",
};

type Action = "create" | "refresh" | "complete";

class ChartUploadBoundaryError extends Error {
  constructor(
    readonly code:
      | "INVALID_REQUEST"
      | "PAYLOAD_TOO_LARGE"
      | "UNAUTHORIZED"
      | "INVALID_USER_IDENTITY"
      | "AI_SERVICE_UNAVAILABLE"
      | "AI_SERVICE_CONTRACT_VIOLATION",
    readonly status: number
  ) {
    super(code);
    this.name = "ChartUploadBoundaryError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseCreateBody(request: Request) {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    throw new ChartUploadBoundaryError("INVALID_REQUEST", 400);
  }
  if (new TextEncoder().encode(raw).byteLength > 1024) {
    throw new ChartUploadBoundaryError("PAYLOAD_TOO_LARGE", 413);
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new ChartUploadBoundaryError("INVALID_REQUEST", 400);
  }
  if (
    !isRecord(body) ||
    Object.keys(body).some(
      (key) => !["content_type", "byte_size"].includes(key)
    ) ||
    typeof body.content_type !== "string" ||
    !CONTENT_TYPES.has(body.content_type) ||
    typeof body.byte_size !== "number" ||
    !Number.isInteger(body.byte_size) ||
    body.byte_size < 1
  ) {
    throw new ChartUploadBoundaryError("INVALID_REQUEST", 400);
  }
  if (body.byte_size > MAX_CHART_BYTES) {
    throw new ChartUploadBoundaryError("PAYLOAD_TOO_LARGE", 413);
  }
  return { content_type: body.content_type, byte_size: body.byte_size };
}

function validGrant(payload: unknown): boolean {
  if (!isRecord(payload) || !isRecord(payload.data)) return false;
  const { data } = payload;
  return (
    typeof data.asset_id === "string" &&
    ASSET_ID.test(data.asset_id) &&
    typeof data.upload_url === "string" &&
    data.upload_url.startsWith("https://") &&
    data.method === "PUT" &&
    isRecord(data.headers) &&
    typeof data.headers["Content-Type"] === "string" &&
    CONTENT_TYPES.has(data.headers["Content-Type"] as string) &&
    typeof data.expires_at === "string" &&
    typeof data.intent_expires_at === "string"
  );
}

function validAsset(payload: unknown): boolean {
  return (
    isRecord(payload) &&
    isRecord(payload.data) &&
    typeof payload.data.asset_id === "string" &&
    ASSET_ID.test(payload.data.asset_id) &&
    typeof payload.data.image_url === "string" &&
    isFetchableImageUrl(payload.data.image_url) &&
    typeof payload.data.content_type === "string" &&
    CONTENT_TYPES.has(payload.data.content_type) &&
    typeof payload.data.byte_size === "number" &&
    typeof payload.data.published_at === "string" &&
    typeof payload.data.expires_at === "string"
  );
}

function upstreamFailure(payload: unknown, status: number) {
  const error =
    isRecord(payload) && isRecord(payload.error) ? payload.error : {};
  const code = typeof error.code === "string" ? error.code : "INTERNAL_ERROR";
  const retryable = error.retryable === true;
  const retryAfter =
    typeof error.retry_after_ms === "number" ? error.retry_after_ms : undefined;
  return {
    status: [400, 401, 403, 404, 413, 429, 503].includes(status) ? status : 502,
    payload: {
      error: {
        code,
        message:
          UPSTREAM_MESSAGES[code] ?? "AIHUB từ chối yêu cầu tải ảnh lên.",
        retryable,
        ...(retryAfter === undefined ? {} : { retry_after_ms: retryAfter }),
      },
    },
  };
}

function boundaryResponse(error: unknown, requestId: string) {
  const status =
    error instanceof ChartUploadBoundaryError
      ? error.status
      : error instanceof DemoCredentialError
        ? error.code === "UNAUTHORIZED"
          ? 401
          : 400
        : 503;
  const code =
    error instanceof ChartUploadBoundaryError
      ? error.code
      : error instanceof DemoCredentialError
        ? error.code
        : "AI_SERVICE_UNAVAILABLE";
  const messages: Record<string, string> = {
    INVALID_REQUEST: "Yêu cầu tải ảnh lên không hợp lệ.",
    PAYLOAD_TOO_LARGE: "Yêu cầu tải ảnh lên vượt quá giới hạn.",
    UNAUTHORIZED: "API key không hợp lệ hoặc đã hết hạn.",
    INVALID_USER_IDENTITY: "Mã người dùng không hợp lệ.",
    AI_SERVICE_CONTRACT_VIOLATION:
      "Phản hồi tải ảnh từ AIHUB không đúng định dạng.",
    AI_SERVICE_UNAVAILABLE: "Hiện chưa thể tải ảnh lên. Vui lòng thử lại sau.",
  };
  return NextResponse.json(
    {
      error: {
        code,
        message: messages[code] ?? messages.AI_SERVICE_UNAVAILABLE,
      },
      meta: { request_id: requestId, service: "writing" },
    },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function handleWritingChartUpload(
  request: Request,
  action: Action,
  assetId?: string
) {
  const requestId = `req_${randomUUID()}`;
  try {
    if (!isSameOrigin(request)) {
      throw new ChartUploadBoundaryError("INVALID_REQUEST", 400);
    }
    if (action !== "create" && (!assetId || !ASSET_ID.test(assetId))) {
      throw new ChartUploadBoundaryError("INVALID_REQUEST", 400);
    }
    const createBody =
      action === "create" ? await parseCreateBody(request) : undefined;
    let apiKey: string;
    let userIdentity: string;
    try {
      apiKey = readDemoApiKey(request);
      userIdentity = readDemoUserIdentity(request);
    } catch (error) {
      if (error instanceof DemoCredentialError) throw error;
      throw new ChartUploadBoundaryError("INVALID_REQUEST", 400);
    }
    const environment = readDemoEnvironment(request);
    if (!isDemoEnvironment(environment)) {
      throw new ChartUploadBoundaryError("INVALID_REQUEST", 400);
    }
    let baseUrl: string;
    try {
      baseUrl = resolveDemoBaseUrl(environment);
    } catch (error) {
      if (error instanceof DemoBoundaryError) {
        throw new ChartUploadBoundaryError("AI_SERVICE_UNAVAILABLE", 503);
      }
      throw error;
    }

    const suffix =
      action === "create" ? "" : `/${encodeURIComponent(assetId!)}/${action}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const abortRequest = () => controller.abort();
    request.signal.addEventListener("abort", abortRequest, { once: true });
    let response: Response;
    try {
      response = await fetch(
        `${baseUrl}/v1/ielts/writing/task1/chart-uploads${suffix}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "X-API-Key": apiKey,
            "X-User-Identity": userIdentity,
            "X-Correlation-Id": requestId,
            ...demoBffHeaders(request),
            ...(createBody === undefined
              ? {}
              : { "Content-Type": "application/json" }),
          },
          ...(createBody === undefined
            ? {}
            : { body: JSON.stringify(createBody) }),
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        }
      );
    } catch {
      throw new ChartUploadBoundaryError("AI_SERVICE_UNAVAILABLE", 503);
    } finally {
      clearTimeout(timeout);
      request.signal.removeEventListener("abort", abortRequest);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ChartUploadBoundaryError("AI_SERVICE_CONTRACT_VIOLATION", 502);
    }
    if (!response.ok) {
      const failure = upstreamFailure(payload, response.status);
      return NextResponse.json(failure.payload, {
        status: failure.status,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (!(action === "complete" ? validAsset(payload) : validGrant(payload))) {
      throw new ChartUploadBoundaryError("AI_SERVICE_CONTRACT_VIOLATION", 502);
    }
    return NextResponse.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return boundaryResponse(error, requestId);
  }
}
