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
  isRawKeyFor,
  RAW_KEY_IN_COMMAND_WARNING,
  type SampleRequestKind,
} from "@/lib/sample-request";
import {
  commandForShell,
  SHELLS,
  ShellSwitch,
  type Shell,
} from "@/components/organizations/shell-switch";

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

// Bash ${VAR} and PowerShell $name or $env:NAME, quoted strings, the curl
// binary, flags, and a trailing line continuation (\ in Bash, ` in PowerShell).
const SHELL_TOKEN =
  /(\$\{[^}\n]*\}|\$(?:env:)?[A-Za-z_]\w*|\{\{\w+\}\})|('[^'\n]*'|"(?:[^"\\\n]|\\.)*")|(^\s*curl(?:\.exe)?\b)|((?<=\s)--?[A-Za-z][\w-]*)|(\\$|`$)/gm;
// Includes Postman's {{NAME}}, which Postman resolves even inside single quotes.
const VARIABLE = /(\$\{[^}\n]*\}|\$(?:env:)?[A-Za-z_]\w*|\{\{\w+\}\})/;

function highlightVariables(text: string): ReactNode[] {
  // split() with a capture group puts every variable at an odd index.
  return text.split(VARIABLE).map((part, index) =>
    index % 2 === 1 ? (
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
        {/* A shell expands variables only in double quotes; Postman expands
            {{NAME}} in any string. */}
        {string?.startsWith('"') || string?.includes("{{")
          ? highlightVariables(token)
          : token}
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
  const [shell, setShell] = useState<Shell>("bash");
  // Speaking can send the Published sample answer's URL or the holder's file.
  const [audioSource, setAudioSource] = useState<"url" | "file">("url");
  // Held in this component only: never sent, stored, or put in the URL.
  const [keyInput, setKeyInput] = useState("");
  const rawKey = isRawKeyFor(apiKey, keyInput) ? keyInput.trim() : undefined;
  const keyRejected = keyInput.trim() !== "" && !rawKey;

  const samples = useMemo(
    () =>
      buildSampleRequests({
        apiKey,
        identityConfigured,
        idempotencyKey,
        rawKey,
      }),
    [apiKey, identityConfigured, idempotencyKey, rawKey]
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
  // The request the panel shows: the tab's own, or its upload variant.
  const shown =
    audioSource === "file" && activeSample.upload
      ? activeSample.upload
      : activeSample;
  const { host, path } = splitUrl(shown.url);
  const command = commandForShell(shown, shell);
  const shellTitle = SHELLS.find((option) => option.shell === shell)!.title;
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
        {activeSample.upload && (
          <div className="qs-source">
            <span className="qs-source-label" id="qs-audio-source">
              Gửi audio bằng
            </span>
            <div
              aria-labelledby="qs-audio-source"
              className="qs-tabs"
              role="group"
            >
              {(
                [
                  ["url", "URL mẫu (chạy ngay)"],
                  ["file", "Tệp của bạn"],
                ] as const
              ).map(([value, label]) => (
                <button
                  aria-pressed={audioSource === value}
                  className="qs-tab"
                  key={value}
                  onClick={() => {
                    setAudioSource(value);
                    setCopied(false);
                  }}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="qs-endpoint">
          <strong className="qs-method">{shown.method}</strong>{" "}
          <code className="qs-url">
            {host && <span className="qs-url-host">{host}</span>}
            <span className="qs-url-path">{path}</span>
          </code>
        </p>

        <div className="qs-grid">
          <div className="qs-run">
            {command ? (
              <>
                <div className="qs-key-field">
                  <label htmlFor="qs-raw-key">API key của bạn</label>
                  <input
                    aria-describedby="qs-raw-key-help"
                    aria-invalid={keyRejected}
                    autoComplete="off"
                    id="qs-raw-key"
                    onChange={(event) => {
                      setKeyInput(event.target.value);
                      setCopied(false);
                    }}
                    placeholder={`${apiKey.key_prefix}…`}
                    spellCheck={false}
                    type="password"
                    value={keyInput}
                  />
                  <p className="qs-key-help" id="qs-raw-key-help">
                    Dán raw key để lệnh chạy được ngay khi dán vào terminal. Key
                    chỉ nằm trong tab này: không gửi lên server, không lưu lại.
                    Để trống thì lệnh đọc key từ biến môi trường API_KEY.
                  </p>
                  {keyRejected && (
                    <p className="auth-error" role="alert">
                      Đây không phải raw key của {apiKey.name}: raw key bắt đầu
                      bằng {apiKey.key_prefix} và dài 52 ký tự.
                    </p>
                  )}
                </div>
                {rawKey && (
                  <p className="qs-callout qs-callout--paid">
                    {RAW_KEY_IN_COMMAND_WARNING}
                  </p>
                )}
                <p className={`qs-callout qs-callout--${shown.billing}`}>
                  {shown.usageNote}
                </p>
                {shell === "postman" && (
                  <p className="qs-callout qs-callout--info">
                    Trong Postman: Import › Raw text, dán lệnh rồi bấm Continue.
                    {!rawKey &&
                      " Tạo biến API_KEY trong Environment của Postman, hoặc dán raw key vào ô phía trên trước khi sao chép."}
                    {shown === activeSample.upload &&
                      " Sau khi import, chọn tệp audio của bạn ở field audio trong tab Body."}
                  </p>
                )}
                <div className="qs-terminal">
                  <div className="qs-terminal-bar">
                    <h3 className="qs-visually-hidden">{shellTitle}</h3>
                    <ShellSwitch
                      onChange={(next) => {
                        setShell(next);
                        setCopied(false);
                      }}
                      shell={shell}
                    />
                    <button
                      className="qs-copy"
                      onClick={() => void copyCommand(command)}
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
                    <code>{highlightCommand(command)}</code>
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
                  aria-label={`${shown.label} request headers`}
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
                    {shown.headers.map((header) => (
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
                {shown.identityNote}
              </p>
            </section>

            <section className="qs-block">
              <h3>Body</h3>
              <div className="qs-table-wrap">
                <table
                  aria-label={`${shown.label} request body`}
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
                    {shown.body.map((field) => (
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
              <p className="qs-callout">{shown.note}</p>
            </section>

            <section className="qs-block">
              <h3>Kết quả dự kiến</h3>
              <p className="qs-outcome">
                <strong className="qs-status qs-status--ok">200</strong>
                <span>
                  response có{" "}
                  {shown.expectedOutcomeFields.map((field, index) => (
                    <span key={field}>
                      {index === shown.expectedOutcomeFields.length - 1
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
                  <code className="qs-name">{shown.firstCriterion}</code>
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
