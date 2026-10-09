"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRef, useState } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  containsPrivateJwk,
  type OrganizationIdentityConfig,
} from "@/lib/organization-identity";
import { identityErrorMessage } from "@/lib/organization-identity-bff";

type Source = "url" | "inline";

const disabledIdentityCopy =
  "AIHUB đã tạm vô hiệu hóa identity configuration này. Organization hiện dùng Declared User ID, nghĩa là bất kỳ ai có API key của Organization đều có thể gửi yêu cầu dưới ID của bất kỳ người dùng nào mà không cần chữ ký. Lưu không khôi phục xác minh chữ ký; chỉ AIHUB có thể kích hoạt lại.";

export function OrganizationIdentityForm({
  organizationId,
  initialConfig,
  onboarding = false,
}: {
  organizationId: string;
  initialConfig: OrganizationIdentityConfig;
  onboarding?: boolean;
}) {
  const router = useRouter();
  const [configured, setConfigured] = useState(initialConfig.configured);
  const [source, setSource] = useState<Source>(
    initialConfig.configured && initialConfig.public_keys_jwks
      ? "inline"
      : "url"
  );
  const [issuer, setIssuer] = useState(
    initialConfig.configured ? initialConfig.issuer : ""
  );
  const [jwksUrl, setJwksUrl] = useState(
    initialConfig.configured ? (initialConfig.jwks_url ?? "") : ""
  );
  const [jwksText, setJwksText] = useState(
    initialConfig.configured && initialConfig.public_keys_jwks
      ? JSON.stringify(initialConfig.public_keys_jwks, null, 2)
      : ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pendingInput, setPendingInput] = useState<Record<
    string,
    unknown
  > | null>(null);
  const disabled =
    initialConfig.configured && initialConfig.status === "disabled";

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/identity-config`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        router.replace("/login?error=session");
        return;
      }
      if (response.status === 403) {
        setIssuer("");
        setJwksUrl("");
        setJwksText("");
        setReadOnly(true);
        router.refresh();
        return;
      }
      if (!response.ok) {
        setError(identityErrorMessage(result.error?.code ?? ""));
        return;
      }
      setConfigured(true);
      setSaved(true);
      if (onboarding)
        router.push(
          `/console/orgs/${encodeURIComponent(organizationId)}/api-keys`
        );
      else router.refresh();
    } catch {
      setError("Không thể kết nối AIHUB. Thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || confirmationOpen) return;
    setError("");
    let body: Record<string, unknown>;
    if (source === "inline") {
      let jwks: unknown;
      try {
        jwks = JSON.parse(jwksText);
      } catch {
        setError("Public JWKS phải là JSON hợp lệ.");
        return;
      }
      if (containsPrivateJwk(jwks)) {
        setError(
          "Không gửi private JWK. Hãy xóa các trường private như d, p, q, dp, dq, qi, oth hoặc k."
        );
        return;
      }
      body = { issuer, public_keys_jwks: jwks };
    } else body = { issuer, jwks_url: jwksUrl };

    if (disabled) {
      setPendingInput(body);
      setConfirmationOpen(true);
      return;
    }

    await save(body);
  }

  async function confirmSave() {
    if (!pendingInput || busy) return;
    setError("");
    try {
      await save(pendingInput);
    } finally {
      setPendingInput(null);
      setConfirmationOpen(false);
    }
  }

  if (readOnly)
    return (
      <p className="identity-safe-notice" role="status">
        Quyền truy cập Organization đã thay đổi. Identity configuration đã được
        xóa khỏi màn hình. Tải lại trang để xem quyền hiện tại.
      </p>
    );

  return (
    <section aria-label="Identity configuration" className="identity-panel">
      {disabled && (
        <p className="identity-warning" role="status">
          {disabledIdentityCopy}
        </p>
      )}
      <form className="identity-form" onSubmit={submit}>
        <label htmlFor="identity-issuer">Issuer</label>
        <input
          id="identity-issuer"
          required
          maxLength={2048}
          value={issuer}
          onChange={(event) => setIssuer(event.target.value)}
        />
        <fieldset>
          <legend>Nguồn public JWKS</legend>
          <label>
            <input
              type="radio"
              name="identity-source"
              checked={source === "url"}
              onChange={() => setSource("url")}
            />{" "}
            JWKS URL (khuyến nghị)
          </label>
          <label>
            <input
              type="radio"
              name="identity-source"
              checked={source === "inline"}
              onChange={() => setSource("inline")}
            />{" "}
            Dán public JWKS
          </label>
          {source === "url" ? (
            <>
              <label htmlFor="identity-jwks-url">JWKS URL</label>
              <input
                id="identity-jwks-url"
                type="url"
                required
                placeholder="https://id.example.com/.well-known/jwks.json"
                value={jwksUrl}
                onChange={(event) => setJwksUrl(event.target.value)}
              />
              <p>Dùng HTTPS trên host công khai do Organization kiểm soát.</p>
            </>
          ) : (
            <>
              <label htmlFor="identity-jwks-inline">Public JWKS (JSON)</label>
              <textarea
                id="identity-jwks-inline"
                rows={9}
                required
                spellCheck={false}
                value={jwksText}
                onChange={(event) => setJwksText(event.target.value)}
              />
              <p>Chỉ dán public keys. Không dán private signing keys.</p>
            </>
          )}
        </fieldset>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {saved && !onboarding && (
          <p role="status">Đã lưu identity configuration.</p>
        )}
        <button
          className="auth-submit"
          disabled={busy}
          ref={saveButtonRef}
          type="submit"
        >
          {busy
            ? "Đang lưu…"
            : configured
              ? "Lưu thay đổi"
              : "Lưu identity configuration"}
        </button>
      </form>
      {disabled && (
        <ConfirmationDialog
          body={<p>{disabledIdentityCopy}</p>}
          cancelLabel="Hủy"
          confirmLabel="Xác nhận"
          onConfirm={confirmSave}
          onOpenChange={(open) => {
            setConfirmationOpen(open);
            if (!open && !busy) setPendingInput(null);
          }}
          open={confirmationOpen}
          pending={busy}
          pendingLabel="Đang lưu…"
          returnFocusRef={saveButtonRef}
          title="Lưu identity configuration?"
        />
      )}
      {onboarding && (
        <Link
          className="identity-skip"
          href={`/console/orgs/${encodeURIComponent(organizationId)}/api-keys`}
        >
          Thiết lập sau, tới API keys
        </Link>
      )}
    </section>
  );
}
