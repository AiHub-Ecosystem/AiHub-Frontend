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

export const DEMO_STEPS = [
  "Kiểm tra API key",
  "Chọn đề",
  "Câu trả lời",
  "Chấm và xem kết quả",
] as const;

export type DemoStep = 1 | 2 | 3 | 4;
export type DemoConsoleTab = "request" | "response";
export type DemoExportFormat = keyof DemoExports;

type DemoWorkbenchProps = {
  skill: "scoring" | "speaking";
  scope: DemoScope;
  title: string;
  description: string;
  step: DemoStep;
  steps?: readonly string[];
  showTrace?: boolean;
  showEnvironmentPicker?: boolean;
  stepperDisabled?: boolean;
  mode: "mock" | "live";
  status: string;
  request: string;
  response: string;
  traceNote?: string;
  environment: DemoEnvironment;
  onEnvironmentChange: (environment: DemoEnvironment) => void;
  /**
   * The Sandbox allowance the last validation reported. `undefined` before any
   * validation has run, so the panel never claims an allowance it has not seen.
   */
  sandboxAllowance: SandboxAllowanceSnapshot | null | undefined;
  productionKeyValidated: boolean;
  productionAcknowledged: boolean;
  requiresProductionAcknowledgement: boolean;
  onAcknowledgeProduction: () => void;
  exports: DemoExports | null;
  overview?: ReactNode;
  children: ReactNode;
};

const STEP_SUMMARY = [
  "Nhập key để kiểm tra môi trường và scope, hoặc bỏ qua để xem bản mẫu.",
  "Chọn một fixture có sẵn cho kỹ năng này.",
  "Xem payload sẽ gửi trước khi chấm.",
  "Gửi request thật hoặc nhận kết quả mẫu cố định.",
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
  steps = DEMO_STEPS,
  showTrace = true,
  showEnvironmentPicker = true,
  stepperDisabled = false,
  mode,
  status,
  request,
  response,
  traceNote,
  environment,
  onEnvironmentChange,
  sandboxAllowance,
  productionKeyValidated,
  productionAcknowledged,
  requiresProductionAcknowledgement,
  onAcknowledgeProduction,
  exports,
  overview,
  children,
}: DemoWorkbenchProps) {
  const [tab, setTab] = useState<DemoConsoleTab>("request");
  const [copied, setCopied] = useState(false);
  const [exportFormat, setExportFormat] = useState<DemoExportFormat>("curl");
  const [exportCopied, setExportCopied] = useState(false);
  const output = tab === "request" ? request : response;

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
    <main
      className={`aihub-demo-flow${overview ? " aihub-demo-flow--custom-overview" : ""}`}
    >
      {!overview && (
        <div className="demo-flow-breadcrumb">
          <Link href="/demo">Danh mục demo</Link>
          <span aria-hidden="true">/</span>
          <span>{title}</span>
        </div>
      )}

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
              : `${demoEnvironmentName(environment)} · Mẫu local`}
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

      {overview ?? (
        <section
          className="demo-overview"
          aria-labelledby="demo-overview-title"
        >
          <div className="demo-section-title">
            <div>
              <p className="demo-flow-eyebrow">OVERVIEW</p>
              <h2 id="demo-overview-title">Từ cấu hình đến response</h2>
            </div>
            <a href="#demo-steps">Mở demo ↗</a>
          </div>
          <ol
            className={
              steps.length === 4
                ? "demo-overview-steps demo-overview-steps--four"
                : "demo-overview-steps"
            }
          >
            {steps.map((label, index) => (
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
      )}

      <section
        className={`demo-flow-grid${showTrace ? "" : " demo-flow-grid--no-trace"}`}
        id="demo-steps"
      >
        <div className="demo-step-panel">
          <div className="demo-panel-heading">
            <div>
              <p className="demo-flow-eyebrow">THỬ TỪNG BƯỚC</p>
              <h2>{title}</h2>
            </div>
            <span className={`demo-mode-badge ${mode}`}>
              <i aria-hidden="true" />{" "}
              {mode === "live"
                ? "Đã xác thực · có thể chỉnh sửa"
                : "Mẫu chỉ đọc"}
            </span>
          </div>
          <nav aria-label="Các bước demo">
            <ol
              className={`demo-stepper${steps.length === 4 ? " demo-stepper--four" : ""}`}
            >
              {steps.map((label, index) => {
                const value = (index + 1) as DemoStep;
                return (
                  <li
                    aria-current={step === value ? "step" : undefined}
                    className={step === value ? "active" : ""}
                    key={label}
                  >
                    <span>{value}</span>
                    {label}
                  </li>
                );
              })}
            </ol>
          </nav>
          {(showEnvironmentPicker ||
            stepperDisabled ||
            (environment === "sandbox" && sandboxAllowance !== undefined) ||
            environment === "production") && (
            <div className="demo-visit-controls">
              {showEnvironmentPicker && (
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
                        disabled={stepperDisabled}
                        name="demo-environment"
                        onChange={() => onEnvironmentChange(value)}
                        type="radio"
                        value={value}
                      />
                      {demoEnvironmentLabel(value)}
                    </label>
                  ))}
                  <p className="demo-help">
                    Chọn môi trường được cấp cho key này. Backend sẽ kiểm tra
                    lại môi trường và scope.
                  </p>
                </fieldset>
              )}
              {stepperDisabled && (
                <p className="demo-notice" role="status">
                  Đang có request chấm trong phiên demo. Chờ request kết thúc
                  rồi mới đổi API key hoặc môi trường.
                </p>
              )}
              {environment === "sandbox" && sandboxAllowance !== undefined && (
                <div className="demo-notice" data-testid="sandbox-allowance">
                  {sandboxAllowance ? (
                    <>
                      Tổ chức hiện tại đã dùng {sandboxAllowance.reserved}/
                      {sandboxAllowance.monthlyLimit} lượt Sandbox trong tháng.{" "}
                      Đây là số liệu tại lúc kiểm tra key; mỗi lần chấm backend
                      sẽ kiểm tra hạn mức lại.
                    </>
                  ) : (
                    <>
                      Không đọc được hạn mức Sandbox của tổ chức hiện tại. Hạn
                      mức sẽ được kiểm tra lại khi chấm.
                    </>
                  )}
                </div>
              )}
              {environment === "production" && (
                <div className="demo-notice demo-billable">
                  {productionKeyValidated && (
                    <p data-testid="production-key-warning" role="status">
                      API key Production đã được xác thực. Mỗi lần chấm thật có
                      thể phát sinh chi phí cho Organization.
                    </p>
                  )}
                  <label className="demo-billable-ack">
                    <input
                      checked={productionAcknowledged}
                      data-testid="production-acknowledgement"
                      disabled={!requiresProductionAcknowledgement}
                      onChange={onAcknowledgeProduction}
                      type="checkbox"
                    />
                    Tôi hiểu chấm bài trên Production có thể phát sinh chi phí
                    thật cho Organization.
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
          )}
          <div className="demo-step-content">{children}</div>
        </div>

        {showTrace && (
          <aside
            className="demo-console"
            aria-label="Request và response của bước hiện tại"
          >
            <div className="demo-console-heading">
              <div>
                <p className="demo-flow-eyebrow">API TRACE</p>
                <h2>Request / Response</h2>
              </div>
              <span
                className={`demo-console-state ${consoleStatusTone(status)}`}
              >
                {status}
              </span>
            </div>
            <div
              className="demo-console-tabs"
              role="tablist"
              aria-label="Nội dung console"
            >
              {(["request", "response"] as const).map((value) => (
                <button
                  aria-selected={tab === value}
                  className={tab === value ? "active" : ""}
                  key={value}
                  onClick={() => setTab(value)}
                  role="tab"
                  type="button"
                >
                  {value === "request" ? "Request" : "Response"}
                </button>
              ))}
              <button
                className="demo-console-copy"
                onClick={copy}
                type="button"
              >
                {copied ? "Đã copy" : "Copy"}
              </button>
            </div>
            <pre className="demo-console-code" role="tabpanel" tabIndex={0}>
              <code>{output}</code>
            </pre>
            <p className="demo-console-note">
              {traceNote ??
                (mode === "mock"
                  ? `Bản mẫu chạy trong trình duyệt, không gửi request tới ${demoEnvironmentName(environment)} hay API chấm. API key luôn được ẩn trong trace.`
                  : `Live gửi qua AIHUB BFF tới ${demoEnvironmentName(environment)} đã ghim host; API key được ẩn trong trace.`)}
            </p>
          </aside>
        )}
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
            {skill === "speaking" &&
              "Lệnh mẫu dùng audio_url qua /v1/ielts/speaking/grading-json; file audio trong demo được gửi qua /v1/ielts/speaking/grading."}{" "}
            {exportFormat === "postman"
              ? "Dán lệnh cURL vào Postman qua Import, rồi đặt biến aihub_api_key trong Environment. Bản copy không chứa API key."
              : exportFormat === "powershell"
                ? `Bản copy không chứa API key. Đặt $env:${DEMO_EXPORT_KEY_ENV} trong PowerShell trước khi chạy.`
                : exportFormat === "curl"
                  ? `Bản copy không chứa API key. Đặt biến ${DEMO_EXPORT_KEY_ENV} trong shell trước khi chạy.`
                  : "Dán prompt vào ChatGPT hoặc coding agent để tạo lệnh Bash, PowerShell và Postman cURL. Prompt chỉ tạo lệnh, không gửi request và không chứa API key thật của bạn."}
          </p>
        </section>
      )}
    </main>
  );
}
