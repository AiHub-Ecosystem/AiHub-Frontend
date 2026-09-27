"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { ApiKeyScope } from "@/lib/api-key-scopes";
import type { MintedOrganizationApiKey } from "@/lib/api-keys";
import { buildSampleRequests, needsIdempotencyKey } from "@/lib/sample-request";

const TAB_OFFSETS = new Map<string, number>([
  ["ArrowRight", 1],
  ["ArrowLeft", -1],
]);

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
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [copied, setCopied] = useState<"key" | "command" | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [activeScope, setActiveScope] = useState<ApiKeyScope | null>(null);

  useEffect(() => {
    if (apiKey && dialog.current && !dialog.current.open) {
      setIdempotencyKey(
        needsIdempotencyKey(apiKey) ? crypto.randomUUID() : null
      );
      setCopied(null);
      dialog.current.showModal();
    }
    if (!apiKey && dialog.current?.open) {
      setIdempotencyKey(null);
      setActiveScope(null);
      setCopied(null);
      dialog.current.close();
    }
  }, [apiKey]);

  const samples = useMemo(() => {
    if (!apiKey) return [];
    if (needsIdempotencyKey(apiKey) && !idempotencyKey) return [];
    return buildSampleRequests({
      apiKey,
      identityConfigured,
      idempotencyKey: idempotencyKey ?? "",
    });
  }, [apiKey, identityConfigured, idempotencyKey]);

  const activeIndex = Math.max(
    0,
    samples.findIndex((sample) => sample.scope === activeScope)
  );
  const activeSample = samples[activeIndex];

  function selectTab(scope: ApiKeyScope, index: number) {
    setActiveScope(scope);
    setCopied(null);
    tabs.current[index]?.focus();
  }

  function onTablistKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const offset = TAB_OFFSETS.get(event.key);
    let nextIndex: number;
    if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = samples.length - 1;
    else if (offset !== undefined)
      nextIndex = (activeIndex + offset + samples.length) % samples.length;
    else return;
    event.preventDefault();
    selectTab(samples[nextIndex].scope, nextIndex);
  }

  async function copy(text: string, item: "key" | "command") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(item);
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
              onClick={() => void copy(apiKey.api_key, "key")}
              type="button"
            >
              {copied === "key" ? "Đã sao chép" : "Sao chép key"}
            </button>
            <button
              className="auth-submit api-key-dialog-close"
              onClick={onClose}
              type="button"
            >
              Đóng
            </button>
          </div>
          {activeSample && (
            <section
              aria-labelledby="sample-request-title"
              className="api-key-sample"
            >
              <h3 id="sample-request-title">Gọi thử</h3>
              <div
                aria-label="Sample requests"
                className="api-key-sample-tabs"
                onKeyDown={onTablistKeyDown}
                role="tablist"
              >
                {samples.map((sample, index) => (
                  <button
                    aria-controls={`sample-panel-${sample.kind}`}
                    aria-selected={sample.scope === activeSample.scope}
                    className="api-key-sample-tab"
                    id={`sample-tab-${sample.kind}`}
                    key={sample.scope}
                    onClick={() => selectTab(sample.scope, index)}
                    ref={(node) => {
                      tabs.current[index] = node;
                    }}
                    role="tab"
                    tabIndex={sample.scope === activeSample.scope ? 0 : -1}
                    type="button"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
              <div
                aria-labelledby={`sample-tab-${activeSample.kind}`}
                className="api-key-sample-panel"
                id={`sample-panel-${activeSample.kind}`}
                role="tabpanel"
                tabIndex={0}
              >
                <p className="api-key-sample-endpoint">
                  <strong>{activeSample.method}</strong>{" "}
                  <code>{activeSample.url}</code>
                </p>
                <h4>Headers</h4>
                <table aria-label={`${activeSample.label} request headers`}>
                  <thead>
                    <tr>
                      <th scope="col">Header</th>
                      <th scope="col">Value</th>
                      <th scope="col">Ý nghĩa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSample.headers.map((header) => (
                      <tr key={header.name}>
                        <th scope="row">{header.name}</th>
                        <td>
                          <code>{header.value}</code>
                        </td>
                        <td>{header.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="api-key-sample-note">
                  {activeSample.identityNote}
                </p>
                {activeSample.contentTypeNote && (
                  <p className="api-key-sample-note">
                    {activeSample.contentTypeNote}
                  </p>
                )}
                <h4>Body</h4>
                <table aria-label={`${activeSample.label} request body`}>
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">Giá trị mẫu</th>
                      <th scope="col">Bắt buộc</th>
                      <th scope="col">Ý nghĩa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSample.body.map((field) => (
                      <tr key={field.field}>
                        <th scope="row">{field.field}</th>
                        <td className="api-key-sample-value">
                          <code>{field.sampleValue}</code>
                        </td>
                        <td>{field.required ? "Có" : "Không"}</td>
                        <td>{field.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="api-key-sample-note">{activeSample.note}</p>
                <h4>Kết quả dự kiến</h4>
                <p>
                  <strong>200</strong>: response có{" "}
                  {activeSample.expectedOutcomeFields.map((field, index) => (
                    <span key={field}>
                      {index === activeSample.expectedOutcomeFields.length - 1
                        ? " và "
                        : index > 0
                          ? ", "
                          : ""}
                      <code>{field}</code>
                    </span>
                  ))}
                  .
                </p>
                <p>Lỗi thường gặp:</p>
                <ul className="api-key-sample-errors">
                  <li>
                    <code>401 UNAUTHORIZED</code>
                  </li>
                  <li>
                    <code>401 INVALID_USER_IDENTITY</code>
                  </li>
                  <li>
                    <code>403 FORBIDDEN</code>
                  </li>
                  <li>
                    <code>403 ENVIRONMENT_NOT_ALLOWED</code>
                  </li>
                  <li>
                    <code>429 RATE_LIMITED</code>
                  </li>
                  <li>
                    <code>429 QUOTA_EXCEEDED</code>
                  </li>
                </ul>
                {activeSample.command ? (
                  <>
                    <p className="api-key-sample-warning">
                      {activeSample.usageNote}
                    </p>
                    <div className="api-key-sample-command-heading">
                      <h4>Lệnh cho Bash-compatible shell</h4>
                      <button
                        className="api-key-action"
                        onClick={() =>
                          void copy(activeSample.command!, "command")
                        }
                        type="button"
                      >
                        {copied === "command"
                          ? "Đã sao chép lệnh"
                          : "Sao chép lệnh"}
                      </button>
                    </div>
                    <pre
                      className="api-key-sample-command"
                      data-testid="sample-request-command"
                      tabIndex={0}
                    >
                      <code>{activeSample.command}</code>
                    </pre>
                  </>
                ) : (
                  <p className="api-key-sample-note" role="status">
                    AIHUB chưa có staging host công khai; API key này không cho
                    phép Environment nào có host công khai nên chưa thể chạy
                    lệnh mẫu.
                  </p>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </dialog>
  );
}
