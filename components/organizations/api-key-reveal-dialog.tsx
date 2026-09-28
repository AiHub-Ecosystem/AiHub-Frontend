"use client";

import { useEffect, useRef, useState } from "react";
import type { MintedOrganizationApiKey } from "@/lib/api-keys";
import { SampleRequests } from "@/components/organizations/sample-requests";

export function ApiKeyRevealDialog({
  apiKey,
  identityConfigured,
  onClose,
  onCopyError,
}: {
  apiKey: MintedOrganizationApiKey | null;
  identityConfigured?: boolean;
  onClose: () => void;
  onCopyError: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (apiKey && dialog.current && !dialog.current.open) {
      setCopied(false);
      dialog.current.showModal();
    }
    if (!apiKey && dialog.current?.open) {
      setCopied(false);
      dialog.current.close();
    }
  }, [apiKey]);

  async function copyKey(rawKey: string) {
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
    } catch {
      onCopyError();
    }
  }

  return (
    <dialog
      aria-labelledby="api-key-reveal-title"
      className="api-key-reveal"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      ref={dialog}
    >
      {apiKey && (
        <>
          <h2 id="api-key-reveal-title">API key mới</h2>
          <p>
            Sao chép và lưu key này ngay. Key chỉ hiển thị lần này và không thể
            xem lại sau khi đóng hộp thoại.
          </p>
          <code className="api-key-raw" data-testid="api-key-raw">
            {apiKey.api_key}
          </code>
          <div className="api-key-dialog-actions">
            <button
              className="api-key-action"
              onClick={() => void copyKey(apiKey.api_key)}
              type="button"
            >
              {copied ? "Đã sao chép" : "Sao chép key"}
            </button>
            <button
              className="auth-submit api-key-dialog-close"
              onClick={onClose}
              type="button"
            >
              Đóng
            </button>
          </div>
          <SampleRequests
            apiKey={apiKey}
            identityConfigured={identityConfigured}
            onCopyError={onCopyError}
          />
        </>
      )}
    </dialog>
  );
}
