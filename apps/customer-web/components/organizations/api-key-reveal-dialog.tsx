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
  commandForShell,
  ShellSwitch,
  type Shell,
} from "@/components/organizations/shell-switch";

/** One copy button: a Sample request, or its upload of the holder's own file. */
type RunnableEntry = {
  id: string;
  kind: SampleRequestKind;
  label: string;
  upload: boolean;
};

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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /**
   * The one place a Sample request carries the raw key without the holder
   * typing it (ADR-0013): copied to the clipboard, never rendered.
   */
  function runnableCommand({ kind, upload }: RunnableEntry): string | null {
    if (!apiKey) return null;
    const sample = buildSampleRequests({
      apiKey,
      identityConfigured,
      idempotencyKey: crypto.randomUUID(),
      rawKey: apiKey.api_key,
    }).find((request) => request.kind === kind);
    return commandForShell(upload ? sample?.upload : sample, shell);
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
            .flatMap(({ kind, label, upload }): RunnableEntry[] => [
              { id: kind, kind, label, upload: false },
              // Speaking also uploads the holder's own file.
              ...(upload?.command
                ? [
                    {
                      id: `${kind}-upload`,
                      kind,
                      label: `${label} (tệp)`,
                      upload: true,
                    },
                  ]
                : []),
            ])
        : [],
    [apiKey, identityConfigured]
  );

  async function copyRunnable(entry: RunnableEntry) {
    const command = runnableCommand(entry);
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopiedId(entry.id);
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
                    setCopiedId(null);
                  }}
                  shell={shell}
                  tone="light"
                />
              </div>
              <p>
                {shell === "postman"
                  ? "Sao chép lệnh đã chứa key này rồi dán vào Postman › Import › Raw text."
                  : "Sao chép lệnh đã chứa key này rồi dán vào terminal là chạy."}
              </p>
              <div className="api-key-run-actions">
                {runnable.map((entry) => (
                  <button
                    className="api-key-action"
                    key={entry.id}
                    onClick={() => void copyRunnable(entry)}
                    type="button"
                  >
                    Sao chép lệnh {entry.label}
                  </button>
                ))}
              </div>
              <p aria-live="polite" className="api-key-run-status">
                {copiedId &&
                  `Đã sao chép lệnh ${runnable.find((item) => item.id === copiedId)?.label}.`}
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
