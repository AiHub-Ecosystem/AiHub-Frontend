"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  DEMO_ENVIRONMENTS,
  demoEnvironmentLabel,
  demoEnvironmentName,
  type DemoEnvironment,
} from "@/lib/demo-environments";
import {
  DEMO_EXPORT_FORMATS,
  DEMO_EXPORT_KEY_ENV,
  type DemoExports,
} from "@/lib/demo-export";
import type { DemoScope } from "./demo-session";
import type { SandboxAllowanceSnapshot } from "./demo-session-state";
import {
  allowanceAdmitsOneMore,
  remainingAllowance,
} from "./demo-session-state";

export const DEMO_STEPS = [
  "Chọn môi trường và key",
  "Chọn đề",
  "Câu trả lời",
  "Chấm và xem kết quả",
  "Retry và lỗi",
] as const;

export type DemoStep = 1 | 2 | 3 | 4 | 5;
export type DemoConsoleTab = "request" | "response" | "headers";
export type DemoExportFormat = keyof DemoExports;

type DemoWorkbenchProps = {
  skill: "scoring" | "speaking";
  scope: DemoScope;
  title: string;
  description: string;
  step: DemoStep;
  onStepChange: (step: DemoStep) => void;
  stepperDisabled?: boolean;
  mode: "mock" | "live";
  status: string;
  request: string;
  response: string;
  requestHeaders: string;
  responseHeaders: string;
  traceNote?: string;
  environment: DemoEnvironment;
  onEnvironmentChange: (environment: DemoEnvironment) => void;
  /**
   * The Sandbox allowance the last validation reported. `undefined` before any
   * validation has run, so the panel never claims an allowance it has not seen.
   */
  sandboxAllowance: SandboxAllowanceSnapshot | null | undefined;
  productionAcknowledged: boolean;
  requiresProductionAcknowledgement: boolean;
  onAcknowledgeProduction: () => void;
  exports: DemoExports | null;
  children: ReactNode;
};

const STEP_SUMMARY = [
  "Chọn Sandbox hoặc Production, rồi kiểm tra key hoặc bỏ qua để xem bản mẫu.",
  "Chọn một fixture có sẵn cho kỹ năng này.",
  "Xem payload sẽ gửi trước khi chấm.",
  "Gửi request thật hoặc nhận kết quả mẫu cố định.",
  "Xem cách xử lý các response lỗi và retry.",
];

function consoleStatusTone(status: string) {
  if (/^HTTP 2\d\d/.test(status)) return "live";
  if (/HTTP [45]\d\d|FAILED|INVALID|ERROR|NO HTTP RESPONSE/.test(status))
    return "error";
  if (
    /MOCK|LOCAL|SIMULATED|FIXTURE|PREVIEW|NOT SENT|OPTIONAL|SKIPPED|READ-ONLY/.test(
      status
    )
  )
    return "mock";
  return "";
}

export function DemoWorkbench({
  skill,
  scope,
  title,
  description,
  step,
  onStepChange,
  stepperDisabled = false,
  mode,
  status,
  request,
  response,
  requestHeaders,
  responseHeaders,
  traceNote,
  environment,
  onEnvironmentChange,
  sandboxAllowance,
  productionAcknowledged,
  requiresProductionAcknowledgement,
  onAcknowledgeProduction,
  exports,
  children,
}: DemoWorkbenchProps) {
  const [tab, setTab] = useState<DemoConsoleTab>("request");
  const [copied, setCopied] = useState(false);
  const [exportFormat, setExportFormat] = useState<DemoExportFormat>("curl");
  const [exportCopied, setExportCopied] = useState(false);
  const output =
    tab === "request"
      ? request
      : tab === "response"
        ? response
        : `# Request headers\n${requestHeaders}\n\n# Response headers\n${responseHeaders}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const copyExport = async () => {
    if (!exports) return;
    try {
      await navigator.clipboard.writeText(exports[exportFormat]);
      setExportCopied(true);
      window.setTimeout(() => setExportCopied(false), 1400);
    } catch {
      setExportCopied(false);
    }
  };

  return (
    <main className="aihub-demo-flow">
      <div className="demo-flow-breadcrumb">
        <Link href="/demo">Danh mục demo</Link>
        <span aria-hidden="true">/</span>
        <span>{title}</span>
      </div>

      <header className="demo-flow-hero">
        <div>
          <p className="demo-flow-eyebrow">
            AIHUB API DEMO · {demoEnvironmentName(environment).toUpperCase()}
          </p>
          <h1>{title}</h1>
          <p className="demo-flow-lede">{description}</p>
        </div>
        <div className="demo-flow-statuses">
          <span className={`demo-mode-badge ${mode}`}>
            <i aria-hidden="true" />{" "}
            {mode === "live"
              ? `Live ${demoEnvironmentName(environment)}`
              : "Mock mẫu"}
          </span>
          <span className="demo-scope-badge">{scope}</span>
        </div>
        <nav className="demo-skill-switch" aria-label="Chọn kỹ năng demo">
          <Link
            aria-current={skill === "scoring" ? "page" : undefined}
            href="/demo/scoring"
          >
            Writing
          </Link>
          <Link
            aria-current={skill === "speaking" ? "page" : undefined}
            href="/demo/speaking"
          >
            Speaking
          </Link>
        </nav>
      </header>

      <section className="demo-overview" aria-labelledby="demo-overview-title">
        <div className="demo-section-title">
          <div>
            <p className="demo-flow-eyebrow">OVERVIEW</p>
            <h2 id="demo-overview-title">Từ cấu hình đến response</h2>
          </div>
          <a href="#demo-steps">Mở demo ↗</a>
        </div>
        <ol className="demo-overview-steps">
          {DEMO_STEPS.map((label, index) => (
            <li className={step === index + 1 ? "active" : ""} key={label}>
              <span>{index + 1}</span>
              <div>
                <strong>{label}</strong>
                <small>{STEP_SUMMARY[index]}</small>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="demo-flow-grid" id="demo-steps">
        <div className="demo-step-panel">
          <div className="demo-panel-heading">
            <div>
              <p className="demo-flow-eyebrow">THỬ TỪNG BƯỚC</p>
              <h2>{title}</h2>
            </div>
            <span className={`demo-mode-badge ${mode}`}>
              <i aria-hidden="true" />{" "}
              {mode === "live" ? "Đã xác thực scope" : "Read-only mẫu"}
            </span>
          </div>
          <nav className="demo-stepper" aria-label="Các bước demo">
            {DEMO_STEPS.map((label, index) => {
              const value = (index + 1) as DemoStep;
              return (
                <button
                  aria-current={step === value ? "step" : undefined}
                  className={step === value ? "active" : ""}
                  disabled={stepperDisabled}
                  key={label}
                  onClick={() => onStepChange(value)}
                  type="button"
                >
                  <span>{value}</span>
                  {label}
                </button>
              );
            })}
          </nav>
          <div className="demo-visit-controls">
            <fieldset className="demo-env-picker">
              <legend>Môi trường demo</legend>
              {DEMO_ENVIRONMENTS.map((value) => (
                <label
                  className={`demo-btn-secondary ${environment === value ? "active" : ""}`}
                  key={value}
                >
                  <input
                    checked={environment === value}
                    data-testid={`demo-environment-${value}`}
                    name="demo-environment"
                    onChange={() => onEnvironmentChange(value)}
                    type="radio"
                    value={value}
                  />
                  {demoEnvironmentLabel(value)}
                </label>
              ))}
              <p className="demo-help">
                Mặc định Sandbox. Key phải được backend cho phép đúng môi trường
                này; demo không tự đổi host.
              </p>
            </fieldset>
            {environment === "sandbox" && sandboxAllowance !== undefined && (
              <div className="demo-notice" data-testid="sandbox-allowance">
                {sandboxAllowance &&
                allowanceAdmitsOneMore(sandboxAllowance) ? (
                  <>
                    Hạn mức Sandbox còn {remainingAllowance(sandboxAllowance)}/
                    {sandboxAllowance.monthlyLimit} lượt chấm cho Organization.
                  </>
                ) : sandboxAllowance ? (
                  <>
                    Hạn mức Sandbox của Organization đã hết; lượt chấm sẽ bị từ
                    chối.
                  </>
                ) : (
                  <>
                    Demo không đọc được hạn mức Sandbox lúc này, nên không khẳng
                    định là còn lượt.
                  </>
                )}{" "}
                Đây là ảnh chụp tại thời điểm kiểm tra, tách khỏi việc key có
                hợp lệ không, và không giữ chỗ: mỗi lần chấm backend kiểm tra
                lại.
              </div>
            )}
            {environment === "production" && (
              <div className="demo-notice demo-billable">
                <label className="demo-billable-ack">
                  <input
                    checked={productionAcknowledged}
                    data-testid="production-acknowledgement"
                    disabled={!requiresProductionAcknowledgement}
                    onChange={onAcknowledgeProduction}
                    type="checkbox"
                  />
                  Tôi hiểu request trên Production có thể phát sinh chi phí thật
                  cho Organization.
                </label>
                <p className="demo-help">
                  Xác nhận này áp dụng cho lần chấm Production đầu tiên của
                  phiên demo và bị xoá khi bạn đổi key hoặc đổi môi trường. Nó
                  không phải hạn mức chi — backend vẫn kiểm tra key, quota và
                  rate của Organization.
                </p>
              </div>
            )}
          </div>
          <div className="demo-step-content">{children}</div>
        </div>

        <aside
          className="demo-console"
          aria-label="Request và response của bước hiện tại"
        >
          <div className="demo-console-heading">
            <div>
              <p className="demo-flow-eyebrow">API TRACE</p>
              <h2>Request / Response</h2>
            </div>
            <span className={`demo-console-state ${consoleStatusTone(status)}`}>
              {status}
            </span>
          </div>
          <div
            className="demo-console-tabs"
            role="tablist"
            aria-label="Nội dung console"
          >
            {(["request", "response", "headers"] as const).map((value) => (
              <button
                aria-selected={tab === value}
                className={tab === value ? "active" : ""}
                key={value}
                onClick={() => setTab(value)}
                role="tab"
                type="button"
              >
                {value === "request"
                  ? "Request"
                  : value === "response"
                    ? "Response"
                    : "Headers"}
              </button>
            ))}
            <button className="demo-console-copy" onClick={copy} type="button">
              {copied ? "Đã copy" : "Copy"}
            </button>
          </div>
          <pre className="demo-console-code" role="tabpanel" tabIndex={0}>
            <code>{output}</code>
          </pre>
          <p className="demo-console-note">
            {traceNote ??
              (mode === "mock"
                ? "Mock chạy trong trình duyệt, không gọi API chấm. API key luôn được ẩn trong trace."
                : `Live gửi qua AIHUB BFF tới ${demoEnvironmentName(environment)} đã ghim host; API key được ẩn trong trace.`)}
          </p>
        </aside>
      </section>

      {exports && (
        <section
          className="demo-exports"
          aria-label="Copy request của bước hiện tại"
        >
          <div className="demo-section-title">
            <div>
              <p className="demo-flow-eyebrow">COPY</p>
              <h2>Copy request sang công cụ khác</h2>
            </div>
          </div>
          <div
            className="demo-console-tabs"
            role="tablist"
            aria-label="Định dạng copy"
          >
            {DEMO_EXPORT_FORMATS.map((format) => (
              <button
                aria-selected={exportFormat === format.id}
                className={exportFormat === format.id ? "active" : ""}
                key={format.id}
                onClick={() => setExportFormat(format.id)}
                role="tab"
                type="button"
              >
                {format.label}
              </button>
            ))}
            <button
              className="demo-console-copy"
              data-testid="button-copy-export"
              onClick={copyExport}
              type="button"
            >
              {exportCopied ? "Đã copy" : "Copy"}
            </button>
          </div>
          <pre
            className="demo-console-code"
            data-testid="export-artifact"
            role="tabpanel"
            tabIndex={0}
          >
            <code>{exports[exportFormat]}</code>
          </pre>
          <p className="demo-console-note">
            Bản copy không chứa API key của bạn. Đặt biến {DEMO_EXPORT_KEY_ENV}{" "}
            trong shell trước khi chạy, hoặc điền biến aihub_api_key trong môi
            trường Postman.
          </p>
        </section>
      )}
    </main>
  );
}
