"use client";

import { useState } from "react";
import { apiKeyScopeOptions } from "@/lib/api-key-scopes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type CreateApiKeyPayload = {
  name: string;
  scopes: string[];
  allowed_environments: string[];
  expires_at?: string;
};

export type CreateApiKeyResult = boolean | "uncertain";

/**
 * The environments a new key may be bound to, and the default. Sandbox first:
 * a first call on it costs the Organization nothing (ADR-0018).
 */
const CREATE_ENVIRONMENTS = [
  { value: "sandbox", label: "Sandbox (miễn phí)", billed: false },
  { value: "production", label: "Production (tính phí)", billed: true },
] as const;

type CreateEnvironment = (typeof CREATE_ENVIRONMENTS)[number]["value"];

export function ApiKeyCreateForm({
  entitlements,
  keyCount,
  busy,
  onCreate,
}: {
  entitlements: string[];
  keyCount: number;
  busy: boolean;
  onCreate: (payload: CreateApiKeyPayload) => Promise<CreateApiKeyResult>;
}) {
  const [validationError, setValidationError] = useState("");
  const [open, setOpen] = useState(false);
  const [environment, setEnvironment] = useState<CreateEnvironment>("sandbox");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const scopes = apiKeyScopeOptions(entitlements);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const selected = CREATE_ENVIRONMENTS.find(
    (option) => option.value === environment
  );

  function clearError() {
    setValidationError("");
  }

  /**
   * Dialog content unmounts on close, which discards the uncontrolled name and
   * expiry fields. The controlled fields would otherwise outlive the dialog and
   * greet the holder with scopes they thought they had cleared.
   */
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) return;
    setEnvironment("sandbox");
    setSelectedScopes([]);
    setValidationError("");
  }

  function toggleScope(scope: string, checked: boolean) {
    setSelectedScopes((current) =>
      checked ? [...current, scope] : current.filter((s) => s !== scope)
    );
    clearError();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = values.get("name");
    const expiryInput = values.get("expires_at");
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
      setValidationError("Tên API key phải có từ 1 đến 100 ký tự.");
      return;
    }
    if (selectedScopes.length === 0) {
      setValidationError("Chọn ít nhất một scope được phép.");
      return;
    }
    let expiresAt: string | undefined;
    if (typeof expiryInput === "string" && expiryInput) {
      const expiryTime = new Date(expiryInput).getTime();
      if (
        !Number.isFinite(expiryTime) ||
        expiryTime <= Date.now() ||
        expiryTime > Date.now() + 365 * 24 * 60 * 60 * 1000
      ) {
        setValidationError(
          "Ngày hết hạn phải trong tương lai và không quá 365 ngày."
        );
        return;
      }
      expiresAt = new Date(expiryTime).toISOString();
    }

    setValidationError("");
    const succeeded = await onCreate({
      name: name.trim(),
      scopes: selectedScopes,
      allowed_environments: [environment],
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    });
    if (succeeded === true) {
      form.reset();
      setEnvironment("sandbox");
      setSelectedScopes([]);
      setOpen(false);
    } else if (succeeded === "uncertain") setOpen(false);
  }

  return (
    <div className="api-key-create">
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogTrigger asChild>
          <button
            className="console-primary-action"
            disabled={keyCount >= 50 || busy}
            type="button"
          >
            Tạo API key
          </button>
        </DialogTrigger>
        <DialogContent
          aria-describedby="api-key-create-description"
          className="api-key-create-dialog"
        >
          <DialogHeader>
            <DialogTitle>Tạo API key</DialogTitle>
            <DialogDescription id="api-key-create-description">
              Chọn các quyền API cần cho tích hợp của bạn.
            </DialogDescription>
          </DialogHeader>
          <form className="api-key-form" onSubmit={submit}>
            <label htmlFor="api-key-name">Tên API key</label>
            <input
              id="api-key-name"
              name="name"
              maxLength={100}
              placeholder="Ví dụ: Backend production"
              required
            />

            <p className="api-key-help">
              Key chỉ chạy trên một môi trường. Sandbox không tính vào hạn mức
              trả phí của Organization; Production thì có.
            </p>

            <fieldset className="api-key-options">
              <legend>Môi trường</legend>
              {CREATE_ENVIRONMENTS.map((option) => (
                <label className="api-key-option" key={option.value}>
                  <input
                    checked={environment === option.value}
                    name="environment"
                    onChange={() => {
                      // The permitted scope set belongs to an Environment, so a
                      // selection made for the other one is dropped rather than
                      // sent against a key the holder never chose it for.
                      setEnvironment(option.value);
                      setSelectedScopes([]);
                      clearError();
                    }}
                    type="radio"
                    value={option.value}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>

            {selected?.billed && (
              <p className="api-key-help">
                Key Production được tính phí. Mọi request, kể cả gọi thử, đều
                tính vào hạn mức sử dụng của Organization.
              </p>
            )}

            <fieldset className="api-key-options">
              <legend>Scopes</legend>
              {scopes.map((option) => (
                <label className="api-key-option" key={option.scope}>
                  <input
                    type="checkbox"
                    name="scopes"
                    value={option.scope}
                    checked={selectedScopes.includes(option.scope)}
                    disabled={!option.available}
                    onChange={(event) =>
                      toggleScope(option.scope, event.target.checked)
                    }
                  />
                  <span>
                    {option.scope}
                    {!option.available && (
                      <span className="api-key-unavailable">
                        {option.service} chưa được bật cho Organization. Liên hệ
                        AIHUB để cấp quyền.
                      </span>
                    )}
                  </span>
                </label>
              ))}
              <p className="api-key-help">
                Chỉ chọn scope cần thiết. Chọn ít nhất một scope.
              </p>
            </fieldset>

            <label htmlFor="api-key-expires-at">
              Hết hạn lúc (không bắt buộc)
            </label>
            <input
              id="api-key-expires-at"
              name="expires_at"
              type="datetime-local"
              aria-describedby="api-key-expiry-help"
            />
            <p className="api-key-help" id="api-key-expiry-help">
              Múi giờ: {timeZone}. Tối đa 365 ngày tính từ lúc tạo.
            </p>

            {validationError && (
              <p className="auth-error" role="alert">
                {validationError}
              </p>
            )}
            <button
              className="auth-submit"
              disabled={busy || keyCount >= 50}
              type="submit"
            >
              {busy ? "Đang tạo…" : "Tạo key"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
      {keyCount >= 50 && (
        <p className="api-key-notice" role="status">
          Đã đạt giới hạn 50 API key. Key hết hạn vẫn chiếm một chỗ cho đến khi
          được thu hồi; hãy thu hồi key không còn dùng.
        </p>
      )}
    </div>
  );
}
