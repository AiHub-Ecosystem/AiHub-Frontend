"use client";

import { useState } from "react";
import { isFetchableImageUrl } from "@/data/writing-task1-request";
import type { DemoEnvironment } from "@/lib/demo-environments";
import { errorFromPayload } from "./scoring-client";
import type { PublicError } from "./scoring-client";

const MAX_CHART_BYTES = 10 * 1024 * 1024;
const CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
type UploadStatus = "idle" | "preparing" | "uploading" | "verifying";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringFields(value: Record<string, unknown>) {
  const fields: Record<string, string> = {};
  for (const [name, field] of Object.entries(value)) {
    if (typeof field !== "string") return null;
    fields[name] = field;
  }
  return fields;
}

function chartUploadGrant(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.data)) return null;
  const { data } = payload;
  const fields = isRecord(data.fields) ? stringFields(data.fields) : null;
  if (
    typeof data.asset_id !== "string" ||
    !/^chart_[0-9A-HJKMNP-TV-Z]{26}$/.test(data.asset_id) ||
    typeof data.upload_url !== "string" ||
    !data.upload_url.startsWith("https://") ||
    data.method !== "POST" ||
    fields === null ||
    !CONTENT_TYPES.has(fields["Content-Type"]) ||
    typeof data.expires_at !== "string" ||
    typeof data.intent_expires_at !== "string"
  ) {
    return null;
  }
  return {
    assetId: data.asset_id,
    uploadUrl: data.upload_url,
    fields,
  };
}

function chartImageUrl(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.data)) return null;
  const imageUrl = payload.data.image_url;
  return typeof imageUrl === "string" && isFetchableImageUrl(imageUrl)
    ? imageUrl
    : null;
}

export function ChartImageUpload({
  apiKey,
  environment,
  identity,
  identityValid,
  grading,
  onBusyChange,
  onUploaded,
}: {
  apiKey: string;
  environment: DemoEnvironment;
  identity: string;
  identityValid: boolean;
  grading: boolean;
  onBusyChange: (busy: boolean) => void;
  onUploaded: (imageUrl: string) => void;
}) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<PublicError | null>(null);

  const upload = async (file: File) => {
    setError(null);
    if (!identityValid) {
      setError({
        code: "INVALID_USER_IDENTITY",
        message: "Nhập mã người dùng hợp lệ trước khi tải ảnh lên.",
      });
      return;
    }
    if (!CONTENT_TYPES.has(file.type)) {
      setError({
        code: "INVALID_REQUEST",
        message: "Chỉ nhận ảnh JPEG, PNG hoặc WebP.",
      });
      return;
    }
    if (file.size < 1 || file.size > MAX_CHART_BYTES) {
      setError({
        code: "PAYLOAD_TOO_LARGE",
        message: "Ảnh phải có kích thước tối đa 10 MiB.",
      });
      return;
    }

    onBusyChange(true);
    setStatus("preparing");
    const authHeaders = {
      "Content-Type": "application/json",
      "X-Demo-API-Key": apiKey.trim(),
      "X-Demo-Environment": environment,
      "X-Demo-User-Identity": identity,
    };
    try {
      const created = await fetch("/api/demo/scoring/chart-uploads", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ content_type: file.type, byte_size: file.size }),
        cache: "no-store",
      });
      let payload: unknown = await created.json().catch(() => null);
      if (!created.ok) throw errorFromPayload(payload);
      let grant = chartUploadGrant(payload);
      if (!grant) {
        throw {
          code: "AI_SERVICE_CONTRACT_VIOLATION",
          message: "Không đọc được thông tin tải ảnh từ AIHUB.",
        } satisfies PublicError;
      }

      const postChart = (uploadUrl: string, fields: Record<string, string>) => {
        const body = new FormData();
        for (const [name, value] of Object.entries(fields)) {
          body.append(name, value);
        }
        body.append("file", file);
        return fetch(uploadUrl, {
          method: "POST",
          body,
          cache: "no-store",
          credentials: "omit",
          redirect: "error",
        });
      };
      setStatus("uploading");
      let upload = await postChart(grant.uploadUrl, grant.fields);
      if (upload.status === 401 || upload.status === 403) {
        const refreshed = await fetch(
          `/api/demo/scoring/chart-uploads/${grant.assetId}/refresh`,
          { method: "POST", headers: authHeaders, cache: "no-store" }
        );
        payload = await refreshed.json().catch(() => null);
        if (!refreshed.ok) throw errorFromPayload(payload);
        const refreshedGrant = chartUploadGrant(payload);
        if (!refreshedGrant || refreshedGrant.assetId !== grant.assetId) {
          throw {
            code: "AI_SERVICE_CONTRACT_VIOLATION",
            message: "Không làm mới được đường dẫn tải ảnh.",
          } satisfies PublicError;
        }
        grant = refreshedGrant;
        upload = await postChart(grant.uploadUrl, grant.fields);
      }
      if (!upload.ok) {
        throw {
          code: "AI_SERVICE_UNAVAILABLE",
          message: "Không tải được ảnh lên kho. Kiểm tra kết nối rồi thử lại.",
        } satisfies PublicError;
      }

      setStatus("verifying");
      const completed = await fetch(
        `/api/demo/scoring/chart-uploads/${grant.assetId}/complete`,
        { method: "POST", headers: authHeaders, cache: "no-store" }
      );
      payload = await completed.json().catch(() => null);
      if (!completed.ok) throw errorFromPayload(payload);
      const imageUrl = chartImageUrl(payload);
      if (!imageUrl) {
        throw {
          code: "AI_SERVICE_CONTRACT_VIOLATION",
          message: "AIHUB chưa trả về đường dẫn ảnh hợp lệ.",
        } satisfies PublicError;
      }
      onUploaded(imageUrl);
    } catch (caught) {
      const publicError =
        typeof caught === "object" &&
        caught !== null &&
        "code" in caught &&
        "message" in caught
          ? (caught as PublicError)
          : {
              code: "AI_SERVICE_UNAVAILABLE",
              message: "Không tải được ảnh. Kiểm tra kết nối rồi thử lại.",
            };
      setError(publicError);
    } finally {
      setStatus("idle");
      onBusyChange(false);
    }
  };

  return (
    <div className="demo-field">
      <label htmlFor="writing-chart-file">Chọn ảnh biểu đồ</label>
      <input
        accept="image/jpeg,image/png,image/webp"
        disabled={!identityValid || grading || status !== "idle"}
        id="writing-chart-file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void upload(file);
        }}
        type="file"
      />
      <p className="demo-help">
        Chọn JPEG, PNG hoặc WebP, tối đa 10 MiB. Ảnh sẽ được xác minh trước khi
        dùng để chấm.
      </p>
      <div className="demo-notice" role="note">
        Ảnh đã tải lên có thể được bất kỳ ai có đường dẫn xem và chia sẻ trong
        24 giờ.
      </div>
      {status !== "idle" && (
        <p aria-live="polite" role="status">
          {status === "preparing"
            ? "Đang chuẩn bị tải ảnh…"
            : status === "uploading"
              ? "Đang tải ảnh lên…"
              : "Đang xác minh và hoàn tất…"}
        </p>
      )}
      {error && (
        <div className="demo-error" role="alert">
          {error.message}
        </div>
      )}
    </div>
  );
}
