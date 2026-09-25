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
  const scopes = apiKeyScopeOptions(entitlements);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = values.get("name");
    const selectedScopes = values.getAll("scopes");
    const environments = values.getAll("allowed_environments");
    const expiryInput = values.get("expires_at");
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
      setValidationError("Tên API key phải có từ 1 đến 100 ký tự.");
      return;
    }
    if (
      selectedScopes.length === 0 ||
      selectedScopes.some((scope) => typeof scope !== "string")
    ) {
      setValidationError("Chọn ít nhất một scope được phép.");
      return;
    }
    if (environments.length === 0) {
      setValidationError("Chọn ít nhất một môi trường.");
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
      scopes: selectedScopes as string[],
      allowed_environments: environments as string[],
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    });
    if (succeeded === true) {
      form.reset();
      setOpen(false);
    } else if (succeeded === "uncertain") setOpen(false);
  }

  return (
    <div className="api-key-create">
      <Dialog onOpenChange={setOpen} open={open}>
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
              Chọn quyền và môi trường đúng với nhu cầu tích hợp.
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
              <legend>Scopes</legend>
              {scopes.map((option) => (
                <label className="api-key-option" key={option.scope}>
                  <input
                    type="checkbox"
                    name="scopes"
                    value={option.scope}
                    disabled={!option.available}
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

            <fieldset className="api-key-options">
              <legend>Môi trường được phép</legend>
              <label className="api-key-option">
                <input
                  type="checkbox"
                  name="allowed_environments"
                  value="production"
                  defaultChecked
                />
                production
              </label>
              <label className="api-key-option">
                <input
                  type="checkbox"
                  name="allowed_environments"
                  value="staging"
                />
                staging
              </label>
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
