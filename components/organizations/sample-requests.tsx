"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  buildSampleRequests,
  type SampleRequestKey,
  type SampleRequestKind,
} from "@/lib/sample-request";

const TAB_OFFSETS = new Map<string, number>([
  ["ArrowRight", 1],
  ["ArrowLeft", -1],
]);

/** One tab per Sample request the key's scopes permit, Writing first. */
export function SampleRequests({
  apiKey,
  identityConfigured,
  idempotencyKey: initialIdempotencyKey,
  onCopyError,
}: {
  apiKey: SampleRequestKey;
  identityConfigured?: boolean;
  /** Required when rendered on the server; one per page load. */
  idempotencyKey?: string;
  /** Without one, the copy failure is reported beside the command. */
  onCopyError?: () => void;
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  // A server render passes its own, so the server and the browser agree.
  const [idempotencyKey] = useState(
    () => initialIdempotencyKey ?? crypto.randomUUID()
  );
  const [activeKind, setActiveKind] = useState<SampleRequestKind | null>(null);

  const samples = useMemo(
    () => buildSampleRequests({ apiKey, identityConfigured, idempotencyKey }),
    [apiKey, identityConfigured, idempotencyKey]
  );
  const activeIndex = Math.max(
    0,
    samples.findIndex((sample) => sample.kind === activeKind)
  );
  const activeSample = samples[activeIndex];

  function selectTab(kind: SampleRequestKind, index: number) {
    setActiveKind(kind);
    setCopied(false);
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
    selectTab(samples[nextIndex].kind, nextIndex);
  }

  async function copyCommand(command: string) {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      if (onCopyError) onCopyError();
      else setCopyFailed(true);
    }
  }

  if (!activeSample) return null;
  return (
    <section aria-labelledby="sample-request-title" className="api-key-sample">
      <h2 id="sample-request-title">Gọi thử</h2>
      <div
        aria-label="Sample requests"
        className="api-key-sample-tabs"
        onKeyDown={onTablistKeyDown}
        role="tablist"
      >
        {samples.map((sample, index) => (
          <button
            aria-controls={`sample-panel-${sample.kind}`}
            aria-selected={sample.kind === activeSample.kind}
            className="api-key-sample-tab"
            id={`sample-tab-${sample.kind}`}
            key={sample.kind}
            onClick={() => selectTab(sample.kind, index)}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            role="tab"
            tabIndex={sample.kind === activeSample.kind ? 0 : -1}
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
          <strong>{activeSample.method}</strong> <code>{activeSample.url}</code>
        </p>
        <h3>Headers</h3>
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
        <p className="api-key-sample-note">{activeSample.identityNote}</p>
        {activeSample.contentTypeNote && (
          <p className="api-key-sample-note">{activeSample.contentTypeNote}</p>
        )}
        <h3>Body</h3>
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
        <h3>Kết quả dự kiến</h3>
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
        <p>
          Tiêu chí đầu tiên: <code>{activeSample.firstCriterion}</code>
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
            <p className="api-key-sample-warning">{activeSample.usageNote}</p>
            <div className="api-key-sample-command-heading">
              <h3>Lệnh cho Bash-compatible shell</h3>
              <button
                className="api-key-action"
                onClick={() => void copyCommand(activeSample.command!)}
                type="button"
              >
                {copied ? "Đã sao chép lệnh" : "Sao chép lệnh"}
              </button>
            </div>
            <pre
              className="api-key-sample-command"
              data-testid="sample-request-command"
              tabIndex={0}
            >
              <code>{activeSample.command}</code>
            </pre>
            {copyFailed && (
              <p className="auth-error" role="alert">
                Không thể sao chép tự động. Hãy chọn và sao chép lệnh ở trên.
              </p>
            )}
          </>
        ) : (
          <p className="api-key-sample-note" role="status">
            AIHUB chưa có staging host công khai; API key này không cho phép
            Environment nào có host công khai nên chưa thể chạy lệnh mẫu.
          </p>
        )}
      </div>
    </section>
  );
}
