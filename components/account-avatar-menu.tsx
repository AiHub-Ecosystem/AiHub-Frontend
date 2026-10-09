"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import type { Avatar } from "@/lib/avatar-contract";
import { AVATAR_CONTENT_TYPES, AVATAR_MAX_BYTES } from "@/lib/avatar-contract";

const CONTENT_TYPES: readonly string[] = AVATAR_CONTENT_TYPES;
const REQUEST_TIMEOUT_MS = 15_000;
const subscribe = () => () => {};
const getAvatarRoot = () =>
  document.querySelector<HTMLElement>("[data-account-avatar-root]");
const getServerAvatarRoot = () => null;
const subscribeToAvatarMenu = (onChange: () => void) => {
  const details = getAvatarRoot()?.closest("details");
  details?.addEventListener("toggle", onChange);
  return () => details?.removeEventListener("toggle", onChange);
};
const getAvatarMenuOpen = () =>
  getAvatarRoot()?.closest<HTMLDetailsElement>("details")?.open ?? false;
const getServerAvatarMenuOpen = () => false;

type Account = { username: string; avatar: Avatar | null };
type UploadGrant = {
  asset_id: string;
  upload_url: string;
  method: "PUT";
  headers: Record<string, string>;
};

function initial(username: string) {
  const segmenter = new Intl.Segmenter("vi", { granularity: "grapheme" });
  return (
    [...segmenter.segment(username)][0]?.segment.toLocaleUpperCase("vi") ?? "?"
  );
}

async function responseError(response: Response, onUnauthorized: () => void) {
  if (response.status === 401) {
    onUnauthorized();
    return "AUTH_REQUIRED";
  }
  if (response.status === 403) return "FORBIDDEN";
  try {
    return (await response.json()).error?.code as string | undefined;
  } catch {
    return undefined;
  }
}

function actionableError(
  code: string | undefined,
  action: "upload" | "remove"
) {
  if (code === "AUTH_REQUIRED")
    return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
  if (
    code === "FORBIDDEN" ||
    code === "AUTH_ACCOUNT_DISABLED" ||
    code === "ACCOUNT_DISABLED"
  )
    return "Tài khoản hiện không được phép quản lý ảnh đại diện. Liên hệ quản trị viên.";
  if (code === "INVALID_REQUEST" || code === "PAYLOAD_TOO_LARGE")
    return "Ảnh không hợp lệ. Chọn JPEG, PNG hoặc WebP có dung lượng tối đa 2 MiB.";
  if (code === "AVATAR_STORAGE_UNAVAILABLE" || code === "STORAGE_UPLOAD_FAILED")
    return "Bộ lưu trữ ảnh đang gặp sự cố. Ảnh hiện tại vẫn được giữ nguyên; hãy thử lại sau.";
  if (code === "NOT_FOUND")
    return "Ảnh chưa có trên bộ lưu trữ. Hãy chọn và tải ảnh lên lại.";
  return action === "upload"
    ? "Không thể cập nhật ảnh đại diện. Ảnh hiện tại vẫn được giữ nguyên; hãy thử lại."
    : "Không thể xóa ảnh đại diện. Ảnh hiện tại vẫn được giữ nguyên; hãy thử lại.";
}

export function AccountAvatarMenu() {
  const root = useSyncExternalStore(
    subscribe,
    getAvatarRoot,
    getServerAvatarRoot
  );
  const menuOpen = useSyncExternalStore(
    subscribeToAvatarMenu,
    getAvatarMenuOpen,
    getServerAvatarMenuOpen
  );
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/account", {
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 401) {
        router.push("/login?error=session");
        return false;
      }
      if (!response.ok) throw new Error("ACCOUNT_UNAVAILABLE");
      const payload = (await response.json()) as { data: Account };
      setAccount(payload.data);
      setImageFailed(false);
      return true;
    } catch {
      setError("Không thể tải thông tin tài khoản.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const details = root?.closest("details");
    if (!details) return;
    const loadWhenOpened = () => {
      if (details.open) void loadAccount();
    };
    details.addEventListener("toggle", loadWhenOpened);
    loadWhenOpened();
    return () => details.removeEventListener("toggle", loadWhenOpened);
  }, [loadAccount, root]);

  const onUnauthorized = useCallback(
    () => router.push("/login?error=session"),
    [router]
  );

  async function selectAvatar(file?: File) {
    if (!file) return;
    setError(null);
    if (
      !CONTENT_TYPES.includes(file.type) ||
      file.size < 1 ||
      file.size > AVATAR_MAX_BYTES
    ) {
      setError("Chọn ảnh JPEG, PNG hoặc WebP có dung lượng tối đa 2 MiB.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    setBusy(true);
    try {
      const grantResponse = await fetch("/api/account/avatar/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_type: file.type, byte_size: file.size }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!grantResponse.ok)
        throw new Error(await responseError(grantResponse, onUnauthorized));
      const { data: grant } = (await grantResponse.json()) as {
        data: UploadGrant;
      };

      const signedHeaders = new Headers(grant.headers);
      // Fetch controls Content-Length; completion checks the stored file size.
      signedHeaders.delete("Content-Length");
      const storageResponse = await fetch(grant.upload_url, {
        method: grant.method,
        headers: signedHeaders,
        body: file,
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!storageResponse.ok) throw new Error("STORAGE_UPLOAD_FAILED");

      const completeResponse = await fetch(
        `/api/account/avatar/uploads/${grant.asset_id}/complete`,
        {
          method: "POST",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }
      );
      if (completeResponse.status === 409) {
        throw new Error(
          (await loadAccount()) ? "AVATAR_CHANGED" : "AVATAR_REFRESH_FAILED"
        );
      }
      if (!completeResponse.ok)
        throw new Error(await responseError(completeResponse, onUnauthorized));
      const payload = (await completeResponse.json()) as { data: Avatar };
      setAccount((current) => current && { ...current, avatar: payload.data });
      setImageFailed(false);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      if (code === "AVATAR_REFRESH_FAILED") return;
      setError(
        code === "AVATAR_CHANGED"
          ? "Ảnh đại diện đã được cập nhật ở nơi khác. Thông tin mới nhất đã được tải."
          : actionableError(code, "upload")
      );
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeAvatar() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/avatar", {
        method: "DELETE",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 409) {
        const refreshed = await loadAccount();
        setConfirmRemove(false);
        throw new Error(refreshed ? "AVATAR_CHANGED" : "AVATAR_REFRESH_FAILED");
      }
      if (!response.ok)
        throw new Error(await responseError(response, onUnauthorized));
      setAccount((current) => current && { ...current, avatar: null });
      setImageFailed(false);
      setConfirmRemove(false);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      setConfirmRemove(false);
      if (code === "AVATAR_REFRESH_FAILED") return;
      setError(
        code === "AVATAR_CHANGED"
          ? "Ảnh đại diện đã được cập nhật ở nơi khác. Thông tin mới nhất đã được tải."
          : actionableError(code, "remove")
      );
    } finally {
      setBusy(false);
    }
  }

  if (!root || !menuOpen) return null;
  return createPortal(
    <section
      aria-label="Ảnh đại diện tài khoản"
      className="account-avatar-panel"
    >
      <div className="account-avatar-heading">
        {account?.avatar && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- Avatar bytes must load directly from storage.
          <img
            alt="Ảnh đại diện"
            className="account-avatar-image"
            onError={() => setImageFailed(true)}
            src={account.avatar.url}
          />
        ) : (
          <span
            aria-label="Ký tự đầu tên người dùng"
            className="account-avatar-fallback"
            role="img"
          >
            {account ? initial(account.username) : "?"}
          </span>
        )}
        <div>
          <strong>{account?.username ?? "Tài khoản"}</strong>
          <p>Ảnh đại diện</p>
        </div>
      </div>
      {loading && <p role="status">Đang tải tài khoản…</p>}
      {error && (
        <p className="account-avatar-error" role="alert">
          {error}
        </p>
      )}
      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label="Chọn ảnh đại diện"
        className="account-avatar-file-input"
        onChange={(event) => void selectAvatar(event.currentTarget.files?.[0])}
        ref={fileInput}
        type="file"
      />
      <button
        disabled={busy || loading || !account}
        onClick={() => fileInput.current?.click()}
        type="button"
      >
        {busy ? "Đang cập nhật…" : account?.avatar ? "Thay ảnh" : "Tải ảnh lên"}
      </button>
      {account?.avatar && (
        <button
          disabled={busy}
          onClick={() => setConfirmRemove(true)}
          type="button"
        >
          Xóa ảnh
        </button>
      )}
      <form action="/api/auth/logout" method="post">
        <button type="submit">Đăng xuất</button>
      </form>
      <ConfirmationDialog
        body="Ảnh đại diện hiện tại sẽ bị xóa khỏi tài khoản của bạn."
        cancelLabel="Hủy"
        confirmLabel="Xóa ảnh"
        destructive
        onConfirm={removeAvatar}
        onOpenChange={setConfirmRemove}
        open={confirmRemove}
        pending={busy}
        pendingLabel="Đang xóa…"
        title="Xóa ảnh đại diện?"
      />
    </section>,
    root
  );
}
