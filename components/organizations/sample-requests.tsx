"use client";

import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { OrganizationApiKey } from "@/lib/api-keys";
import {
  buildSampleRequests,
  type SampleRequestKind,
} from "@/lib/sample-request";

const TAB_OFFSETS = new Map<string, number>([
  ["ArrowRight", 1],
  ["ArrowLeft", -1],
]);

const COMMON_ERRORS = [
  "401 UNAUTHORIZED",
  "401 INVALID_USER_IDENTITY",
  "403 FORBIDDEN",
  "403 ENVIRONMENT_NOT_ALLOWED",
  "429 RATE_LIMITED",
  "429 QUOTA_EXCEEDED",
];

/** A sample value longer than this scrolls inside its cell. */
const LONG_SAMPLE_VALUE = 120;

const SHELL_TOKEN =
  /(\$\{[^}\n]*\})|('[^'\n]*'|"(?:[^"\\\n]|\\.)*")|(^curl\b)|((?<=\s)--?[A-Za-z][\w-]*)|(\\$)/gm;

function highlightVariables(text: string): ReactNode[] {
  return text.split(/(\$\{[^}\n]*\})/).map((part, index) =>
    part.startsWith("${") ? (
      <span className="qs-token-variable" key={index}>
        {part}
      </span>
    ) : (
      part
    )
  );
}

/** Colours the parts of a curl command a holder edits or reads first. */
function highlightCommand(command: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of command.matchAll(SHELL_TOKEN)) {
    const start = match.index;
    if (start > last) nodes.push(command.slice(last, start));
    const [token, variable, string, keyword, flag] = match;
    const className = variable
      ? "qs-token-variable"
      : string
        ? "qs-token-string"
        : keyword
          ? "qs-token-keyword"
          : flag
            ? "qs-token-flag"
            : "qs-token-muted";
    nodes.push(
      <span className={className} key={start}>
        {string ? highlightVariables(token) : token}
      </span>
    );
    last = start + token.length;
  }
  if (last < command.length) nodes.push(command.slice(last));
  return nodes;
}

/** The host is context; the path is what distinguishes one request from another. */
function splitUrl(url: string) {
  const match = /^(https?:\/\/[^/]+)(\/.*)$/.exec(url);
  return match ? { host: match[1], path: match[2] } : { host: "", path: url };
}

/** One tab per Sample request the key's scopes permit, Writing first. */
export function SampleRequests({
  apiKey,
  identityConfigured,
  idempotencyKey,
}: {
  apiKey: OrganizationApiKey;
  identityConfigured?: boolean;
  /** One per page load, made by the server so its render and the browser agree. */
  idempotencyKey: string;
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
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
      setCopyFailed(true);
    }
  }

  if (!activeSample) return null;
  const { host, path } = splitUrl(activeSample.url);
  return (
    <section aria-labelledby="sample-request-title" className="qs">
      <div className="qs-toolbar">
        <h2 id="sample-request-title">Gọi thử</h2>
        <div
          aria-label="Sample requests"
          className="qs-tabs"
          onKeyDown={onTablistKeyDown}
          role="tablist"
        >
          {samples.map((sample, index) => (
            <button
              aria-controls={`sample-panel-${sample.kind}`}
              aria-selected={sample.kind === activeSample.kind}
              className="qs-tab"
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
      </div>

      <div
        aria-labelledby={`sample-tab-${activeSample.kind}`}
        className="qs-panel"
        id={`sample-panel-${activeSample.kind}`}
        role="tabpanel"
        tabIndex={0}
      >
        <p className="qs-endpoint">
          <strong className="qs-method">{activeSample.method}</strong>{" "}
          <code className="qs-url">
            {host && <span className="qs-url-host">{host}</span>}
            <span className="qs-url-path">{path}</span>
          </code>
        </p>

        <div className="qs-grid">
          <div className="qs-run">
            {activeSample.command ? (
              <>
                <p className={`qs-callout qs-callout--${activeSample.billing}`}>
                  {activeSample.usageNote}
                </p>
                <div className="qs-terminal">
                  <div className="qs-terminal-bar">
                    <h3>Lệnh cho Bash-compatible shell</h3>
                    <button
                      className="qs-copy"
                      onClick={() => void copyCommand(activeSample.command!)}
                      type="button"
                    >
                      {copied ? "Đã sao chép lệnh" : "Sao chép lệnh"}
                    </button>
                  </div>
                  <pre
                    className="qs-command"
                    data-testid="sample-request-command"
                    tabIndex={0}
                  >
                    <code>{highlightCommand(activeSample.command)}</code>
                  </pre>
                </div>
                {copyFailed && (
                  <p className="auth-error" role="alert">
                    Không thể sao chép tự động. Hãy chọn và sao chép lệnh ở
                    trên.
                  </p>
                )}
              </>
            ) : (
              <p className="qs-callout qs-callout--muted" role="status">
                AIHUB chưa có staging host công khai; API key này không cho phép
                Environment nào có host công khai nên chưa thể chạy lệnh mẫu.
              </p>
            )}
          </div>

          <div className="qs-docs">
            <section className="qs-block">
              <h3>Headers</h3>
              <div className="qs-table-wrap">
                <table
                  aria-label={`${activeSample.label} request headers`}
                  className="qs-table qs-table--headers"
                >
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
                        <th scope="row">
                          <code className="qs-name">{header.name}</code>
                        </th>
                        <td>
                          <code className="qs-value">{header.value}</code>
                        </td>
                        <td>{header.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="qs-callout qs-callout--info">
                {activeSample.identityNote}
              </p>
              {activeSample.contentTypeNote && (
                <p className="qs-callout qs-callout--info">
                  {activeSample.contentTypeNote}
                </p>
              )}
            </section>

            <section className="qs-block">
              <h3>Body</h3>
              <div className="qs-table-wrap">
                <table
                  aria-label={`${activeSample.label} request body`}
                  className="qs-table qs-table--body"
                >
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
                        <th scope="row">
                          <code className="qs-name">{field.field}</code>
                        </th>
                        <td>
                          {field.sampleValue.length > LONG_SAMPLE_VALUE ? (
                            <code
                              aria-label={`Giá trị mẫu của ${field.field}`}
                              className="qs-value qs-value--long"
                              role="region"
                              tabIndex={0}
                            >
                              {field.sampleValue}
                            </code>
                          ) : (
                            <code className="qs-value">
                              {field.sampleValue}
                            </code>
                          )}
                        </td>
                        <td>
                          <span
                            className={`qs-badge${field.required ? " qs-badge--required" : ""}`}
                          >
                            {field.required ? "Có" : "Không"}
                          </span>
                        </td>
                        <td>{field.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="qs-callout">{activeSample.note}</p>
            </section>

            <section className="qs-block">
              <h3>Kết quả dự kiến</h3>
              <p className="qs-outcome">
                <strong className="qs-status qs-status--ok">200</strong>
                <span>
                  response có{" "}
                  {activeSample.expectedOutcomeFields.map((field, index) => (
                    <span key={field}>
                      {index === activeSample.expectedOutcomeFields.length - 1
                        ? " và "
                        : index > 0
                          ? ", "
                          : ""}
                      <code className="qs-name">{field}</code>
                    </span>
                  ))}
                  .
                </span>
              </p>
              <p className="qs-outcome">
                <span>
                  Tiêu chí đầu tiên:{" "}
                  <code className="qs-name">{activeSample.firstCriterion}</code>
                </span>
              </p>
              <p className="qs-errors-label">Lỗi thường gặp:</p>
              <ul className="qs-errors">
                {COMMON_ERRORS.map((error) => (
                  <li
                    className={
                      error.startsWith("429")
                        ? "qs-status qs-status--warn"
                        : "qs-status qs-status--error"
                    }
                    key={error}
                  >
                    <code>{error}</code>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
