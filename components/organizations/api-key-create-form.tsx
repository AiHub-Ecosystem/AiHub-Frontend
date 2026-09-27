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

/** Mirrors the backend: a Sandbox key allows that Environment and Writing only. */
const SANDBOX_SCOPE = "writing.grade";

const CREATABLE_ENVIRONMENTS = ["production", "sandbox"] as const;
type CreatableEnvironment = (typeof CREATABLE_ENVIRONMENTS)[number];

const ENVIRONMENT_HELP: Record<CreatableEnvironment, string> = {
  production:
    "Key gọi được host production và tính vào hạn mức sử dụng của Organization.",
  sandbox:
    "Key Sandbox chỉ chạy được Writing, miễn phí và không tính vào hạn mức trả phí. Sandbox giới hạn 25 lần chấm mỗi tháng theo Organization.",
};

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
  const [environment, setEnvironment] =
    useState<CreatableEnvironment>("production");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const scopes = apiKeyScopeOptions(entitlements);
  const isSandbox = environment === "sandbox";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

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
    setEnvironment("production");
    setSelectedScopes([]);
    setValidationError("");
  }

  function selectEnvironment(next: CreatableEnvironment) {
    setEnvironment(next);
    if (next === "sandbox")
      setSelectedScopes((current) =>
        current.filter((s) => s === SANDBOX_SCOPE)
      );
    clearError();
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
    if (
      isSandbox &&
      (selectedScopes.length !== 1 || selectedScopes[0] !== SANDBOX_SCOPE)
    ) {
      setValidationError("API key Sandbox chỉ hỗ trợ scope writing.grade.");
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
      setSelectedScopes([]);
      setEnvironment("production");
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

            <fieldset className="api-key-options">
              <legend>Môi trường</legend>
              {CREATABLE_ENVIRONMENTS.map((option) => (
                <label className="api-key-option" key={option}>
                  <input
                    type="radio"
                    name="environment"
                    value={option}
                    checked={environment === option}
                    onChange={() => selectEnvironment(option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
              <p className="api-key-help">{ENVIRONMENT_HELP[environment]}</p>
            </fieldset>

            <fieldset className="api-key-options">
              <legend>Scopes</legend>
              {scopes.map((option) => {
                const blockedByEnvironment =
                  isSandbox && option.scope !== SANDBOX_SCOPE;
                return (
                  <label className="api-key-option" key={option.scope}>
                    <input
                      type="checkbox"
                      name="scopes"
                      value={option.scope}
                      checked={selectedScopes.includes(option.scope)}
                      disabled={!option.available || blockedByEnvironment}
                      onChange={(event) =>
                        toggleScope(option.scope, event.target.checked)
                      }
                    />
                    <span>
                      {option.scope}
                      {blockedByEnvironment && (
                        <span className="api-key-unavailable">
                          Sandbox key chỉ chạy được Writing; Speaking cần key
                          production.
                        </span>
                      )}
                      {!option.available && (
                        <span className="api-key-unavailable">
                          {option.service} chưa được bật cho Organization. Liên
                          hệ AIHUB để cấp quyền.
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
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
