"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MintedOrganizationApiKey } from "@/lib/api-keys";
import {
  buildSampleRequests,
  hasQuickstart,
  quickstartPath,
  RAW_KEY_IN_COMMAND_WARNING,
  type SampleRequestKind,
} from "@/lib/sample-request";
import {
  ShellSwitch,
  type Shell,
} from "@/components/organizations/shell-switch";

export function ApiKeyRevealDialog({
  apiKey,
  identityConfigured,
  organizationId,
  onClose,
  onCopyError,
}: {
  apiKey: MintedOrganizationApiKey | null;
  identityConfigured?: boolean;
  organizationId: string;
  onClose: () => void;
  onCopyError: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [shell, setShell] = useState<Shell>("bash");
  const [copiedKind, setCopiedKind] = useState<SampleRequestKind | null>(null);

  /**
   * The one place a Sample request carries the raw key without the holder
   * typing it (ADR-0013): copied to the clipboard, never rendered.
   */
  function runnableCommand(kind: SampleRequestKind): string | null {
    if (!apiKey) return null;
    const sample = buildSampleRequests({
      apiKey,
      identityConfigured,
      idempotencyKey: crypto.randomUUID(),
      rawKey: apiKey.api_key,
    }).find((request) => request.kind === kind);
    return (
      (shell === "powershell" ? sample?.powershellCommand : sample?.command) ??
      null
    );
  }

  const runnable = useMemo(
    () =>
      apiKey
        ? buildSampleRequests({
            apiKey,
            identityConfigured,
            idempotencyKey: "",
          })
            .filter((request) => request.command)
            .map(({ kind, label }) => ({ kind, label }))
        : [],
    [apiKey, identityConfigured]
  );

  async function copyRunnable(kind: SampleRequestKind) {
    const command = runnableCommand(kind);
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopiedKind(kind);
    } catch {
      onCopyError();
    }
  }

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
            {hasQuickstart(apiKey) && (
              // A new tab keeps this dialog, and the raw key, on screen.
              <a
                aria-label="Gọi thử key này (mở tab mới)"
                className="auth-submit api-key-dialog-primary"
                href={quickstartPath(organizationId, apiKey.id)}
                rel="noopener"
                target="_blank"
              >
                Gọi thử key này →
              </a>
            )}
            <button className="api-key-action" onClick={onClose} type="button">
              Đóng
            </button>
          </div>
          {runnable.length > 0 && (
            <section
              aria-labelledby="api-key-run-title"
              className="api-key-run"
            >
              <div className="api-key-run-heading">
                <h3 id="api-key-run-title">Gọi thử ngay</h3>
                <ShellSwitch
                  onChange={(next) => {
                    setShell(next);
                    setCopiedKind(null);
                  }}
                  shell={shell}
                  tone="light"
                />
              </div>
              <p>Sao chép lệnh đã chứa key này rồi dán vào terminal là chạy.</p>
              <div className="api-key-run-actions">
                {runnable.map(({ kind, label }) => (
                  <button
                    className="api-key-action"
                    key={kind}
                    onClick={() => void copyRunnable(kind)}
                    type="button"
                  >
                    Sao chép lệnh {label}
                  </button>
                ))}
              </div>
              <p aria-live="polite" className="api-key-run-status">
                {copiedKind &&
                  `Đã sao chép lệnh ${runnable.find((item) => item.kind === copiedKind)?.label}.`}
              </p>
              <p className="api-key-run-warning">
                {RAW_KEY_IN_COMMAND_WARNING}
              </p>
            </section>
          )}
        </>
      )}
    </dialog>
  );
}
