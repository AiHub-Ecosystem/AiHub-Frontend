"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseMintedOrganizationApiKey,
  parseOrganizationApiKeyList,
  type MintedOrganizationApiKey,
  type OrganizationApiKey,
} from "@/lib/api-keys";
import type { CreateApiKeyPayload } from "@/components/organizations/api-key-create-form";
import { ApiKeyCreateForm } from "@/components/organizations/api-key-create-form";
import { ApiKeyList } from "@/components/organizations/api-key-list";
import { ApiKeyRevealDialog } from "@/components/organizations/api-key-reveal-dialog";

type Feedback = { kind: "error" | "success"; message: string };

function readErrorCode(value: unknown) {
  if (value === null || typeof value !== "object") return "";
  const error = (value as { error?: { code?: unknown } }).error;
  return typeof error?.code === "string" ? error.code : "";
}

function networkErrorMessage(action: "create" | "rotate") {
  return action === "create"
    ? "Chưa xác nhận được kết quả tạo key. Không tự gửi lại. Hãy tải danh sách, tìm key mới theo tên và prefix, rồi thu hồi nếu không dùng."
    : "Chưa xác nhận được kết quả xoay key. Hãy tải danh sách và xoay key replacement mới nhất để nhận raw key khác.";
}

export function ApiKeyManager({
  organizationId,
  entitlements,
}: {
  organizationId: string;
  entitlements: string[];
}) {
  const router = useRouter();
  const [apiKeys, setApiKeys] = useState<OrganizationApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [revealedKey, setRevealedKey] =
    useState<MintedOrganizationApiKey | null>(null);

  const collectionUrl = `/api/organizations/${encodeURIComponent(organizationId)}/api-keys`;

  const loadApiKeys = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const response = await fetch(collectionUrl, { cache: "no-store" });
      const result = await response.json().catch(() => null);
      const code = readErrorCode(result);
      if (response.status === 401) {
        router.replace("/login?error=session");
        return false;
      }
      if (response.status === 403 || response.status === 404) {
        router.replace("/console/orgs/denied");
        return false;
      }
      const parsed = parseOrganizationApiKeyList(result);
      if (!response.ok || !parsed) {
        setListError(
          code === "API_KEY_LIST_UNAVAILABLE"
            ? "Không thể tải danh sách API key lúc này."
            : "Không thể tải danh sách API key lúc này. Vui lòng thử lại."
        );
        return false;
      }
      setApiKeys(parsed);
      setListError("");
      return true;
    } catch {
      setListError("Không thể kết nối để tải danh sách API key.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [collectionUrl, router]);

  useEffect(() => {
    queueMicrotask(() => void loadApiKeys());
  }, [loadApiKeys]);

  useEffect(() => {
    const clearReveal = () => setRevealedKey(null);
    const clearBeforeNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin === window.location.origin &&
        destination.pathname !== window.location.pathname
      )
        clearReveal();
    };
    document.addEventListener("click", clearBeforeNavigation, true);
    window.addEventListener("pagehide", clearReveal);
    window.addEventListener("popstate", clearReveal);
    window.addEventListener("pageshow", clearReveal);
    return () => {
      document.removeEventListener("click", clearBeforeNavigation, true);
      window.removeEventListener("pagehide", clearReveal);
      window.removeEventListener("popstate", clearReveal);
      window.removeEventListener("pageshow", clearReveal);
    };
  }, []);

  async function createApiKey(payload: CreateApiKeyPayload) {
    if (busyAction) return false;
    setBusyAction("create");
    setFeedback(null);
    try {
      const response = await fetch(collectionUrl, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      const code = readErrorCode(result);
      if (!response.ok) {
        if (response.status >= 500 || code === "API_KEY_CREATE_UNCERTAIN") {
          setFeedback({
            kind: "error",
            message: networkErrorMessage("create"),
          });
          await loadApiKeys();
          return false;
        }
        if (code === "API_KEY_LIMIT_REACHED") {
          setFeedback({
            kind: "error",
            message:
              "Organization đã đạt giới hạn 50 API key. Key hết hạn vẫn chiếm chỗ cho đến khi được thu hồi.",
          });
          await loadApiKeys();
          return false;
        }
        if (code === "API_KEY_SCOPE_NOT_ENTITLED") {
          setFeedback({
            kind: "error",
            message:
              "Organization không còn entitlement cho scope đã chọn. Hãy tải lại danh sách và kiểm tra quyền dịch vụ.",
          });
          await loadApiKeys();
          return false;
        }
        if (response.status === 401) {
          router.replace("/login?error=session");
          return false;
        }
        setFeedback({
          kind: "error",
          message:
            "Không thể tạo API key do quyền truy cập hoặc trạng thái Organization đã thay đổi. Hãy tải lại trạng thái.",
        });
        await loadApiKeys();
        return false;
      }
      const parsed = parseMintedOrganizationApiKey(result);
      if (!parsed) {
        setFeedback({ kind: "error", message: networkErrorMessage("create") });
        await loadApiKeys();
        return false;
      }
      setFeedback(null);
      setRevealedKey(parsed);
      await loadApiKeys();
      return true;
    } catch {
      setFeedback({ kind: "error", message: networkErrorMessage("create") });
      await loadApiKeys();
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function rotateApiKey(apiKey: OrganizationApiKey) {
    if (busyAction) return;
    setBusyAction(`rotate:${apiKey.id}`);
    setFeedback(null);
    try {
      const response = await fetch(
        `${collectionUrl}/${encodeURIComponent(apiKey.id)}/rotate`,
        { method: "POST", cache: "no-store" }
      );
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status >= 500) {
          setFeedback({
            kind: "error",
            message: networkErrorMessage("rotate"),
          });
          await loadApiKeys();
          return;
        }
        if (response.status === 401) {
          router.replace("/login?error=session");
          return;
        }
        setFeedback({
          kind: "error",
          message:
            "Không thể xoay API key do quyền truy cập hoặc trạng thái key đã thay đổi. Hãy tải lại danh sách.",
        });
        await loadApiKeys();
        return;
      }
      const parsed = parseMintedOrganizationApiKey(result);
      if (!parsed) {
        setFeedback({ kind: "error", message: networkErrorMessage("rotate") });
        await loadApiKeys();
        return;
      }
      setFeedback(null);
      setRevealedKey(parsed);
      await loadApiKeys();
    } catch {
      setFeedback({ kind: "error", message: networkErrorMessage("rotate") });
      await loadApiKeys();
    } finally {
      setBusyAction(null);
    }
  }

  async function revokeApiKey(apiKey: OrganizationApiKey) {
    if (busyAction) return false;
    setBusyAction(`revoke:${apiKey.id}`);
    setFeedback(null);
    try {
      const response = await fetch(
        `${collectionUrl}/${encodeURIComponent(apiKey.id)}`,
        { method: "DELETE", cache: "no-store" }
      );
      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/login?error=session");
          return false;
        }
        setFeedback({
          kind: "error",
          message:
            "Không thể xác nhận việc thu hồi. Hãy tải lại danh sách; nếu key vẫn còn, bạn có thể thu hồi lại.",
        });
        await loadApiKeys();
        return false;
      }
      setApiKeys((current) => current.filter((item) => item.id !== apiKey.id));
      setFeedback({ kind: "success", message: "Đã thu hồi API key." });
      await loadApiKeys();
      return true;
    } catch {
      setFeedback({
        kind: "error",
        message:
          "Không thể xác nhận việc thu hồi. Hãy tải lại danh sách; nếu key vẫn còn, bạn có thể thu hồi lại.",
      });
      await loadApiKeys();
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  const expiredCount = apiKeys.filter(
    (apiKey) => apiKey.status === "expired"
  ).length;

  return (
    <section
      aria-labelledby="api-key-manager-title"
      className="api-key-manager"
    >
      <h2 id="api-key-manager-title">API keys</h2>
      <p className="api-key-count">
        {apiKeys.length} / 50 key chưa thu hồi
        {expiredCount > 0 &&
          ` · ${expiredCount} key hết hạn vẫn chiếm chỗ cho đến khi thu hồi`}
      </p>
      <ApiKeyCreateForm
        busy={busyAction !== null}
        entitlements={entitlements}
        keyCount={apiKeys.length}
        onCreate={createApiKey}
      />

      {feedback && (
        <p
          className={
            feedback.kind === "error"
              ? "auth-error api-key-feedback"
              : "api-key-success"
          }
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}
      {feedback?.kind === "error" && (
        <button
          className="api-key-action"
          disabled={busyAction !== null}
          onClick={() => void loadApiKeys()}
          type="button"
        >
          Tải lại danh sách
        </button>
      )}

      {listError ? (
        <div className="api-key-list-error" role="alert">
          <p>{listError}</p>
          <button
            className="api-key-action"
            disabled={loading}
            onClick={() => void loadApiKeys()}
            type="button"
          >
            {loading ? "Đang tải…" : "Thử lại"}
          </button>
        </div>
      ) : loading ? (
        <p role="status">Đang tải API keys…</p>
      ) : (
        <ApiKeyList
          apiKeys={apiKeys}
          busy={busyAction !== null}
          onRevoke={revokeApiKey}
          onRotate={rotateApiKey}
        />
      )}

      <ApiKeyRevealDialog
        apiKey={revealedKey}
        key={revealedKey?.id ?? "closed"}
        onClose={() => setRevealedKey(null)}
        onCopyError={() =>
          setFeedback({
            kind: "error",
            message:
              "Không thể sao chép tự động. Hãy chọn và sao chép key trong hộp thoại.",
          })
        }
      />
    </section>
  );
}
