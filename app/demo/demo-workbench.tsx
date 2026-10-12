"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { DemoScope } from "./demo-session";

export const DEMO_STEPS = [
  "Kết nối Sandbox",
  "Chọn đề",
  "Câu trả lời",
  "Chấm và xem kết quả",
  "Retry và lỗi",
] as const;

export type DemoStep = 1 | 2 | 3 | 4 | 5;
export type DemoConsoleTab = "request" | "response" | "headers";

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
  children: ReactNode;
};

const STEP_SUMMARY = [
  "Kiểm tra key, hoặc bỏ qua để xem bản mẫu.",
  "Chọn một fixture có sẵn cho kỹ năng này.",
  "Xem payload sẽ gửi trước khi chấm.",
  "Gửi request thật hoặc nhận kết quả mẫu cố định.",
  "Xem cách xử lý các response lỗi và retry.",
];

function consoleStatusTone(status: string) {
  if (/^HTTP 2\d\d/.test(status)) return "live";
  if (/HTTP [45]\d\d|FAILED|INVALID|ERROR|NO HTTP RESPONSE/.test(status)) return "error";
  if (/MOCK|LOCAL|SIMULATED|FIXTURE|PREVIEW|NOT SENT|OPTIONAL|SKIPPED|READ-ONLY/.test(status)) return "mock";
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
  children,
}: DemoWorkbenchProps) {
  const [tab, setTab] = useState<DemoConsoleTab>("request");
  const [copied, setCopied] = useState(false);
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

  return (
    <main className="aihub-demo-flow">
      <div className="demo-flow-breadcrumb">
        <Link href="/demo">Danh mục demo</Link>
        <span aria-hidden="true">/</span>
        <span>{title}</span>
      </div>

      <header className="demo-flow-hero">
        <div>
          <p className="demo-flow-eyebrow">AIHUB API DEMO · SANDBOX</p>
          <h1>{title}</h1>
          <p className="demo-flow-lede">{description}</p>
        </div>
        <div className="demo-flow-statuses">
          <span className={`demo-mode-badge ${mode}`}>
            <i aria-hidden="true" /> {mode === "live" ? "Live Sandbox" : "Mock mẫu"}
          </span>
          <span className="demo-scope-badge">{scope}</span>
        </div>
        <nav className="demo-skill-switch" aria-label="Chọn kỹ năng demo">
          <Link aria-current={skill === "scoring" ? "page" : undefined} href="/demo/scoring">
            Writing
          </Link>
          <Link aria-current={skill === "speaking" ? "page" : undefined} href="/demo/speaking">
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
              <i aria-hidden="true" /> {mode === "live" ? "Đã xác thực scope" : "Read-only mẫu"}
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
          <div className="demo-step-content">{children}</div>
        </div>

        <aside className="demo-console" aria-label="Request và response của bước hiện tại">
          <div className="demo-console-heading">
            <div>
              <p className="demo-flow-eyebrow">API TRACE</p>
              <h2>Request / Response</h2>
            </div>
            <span className={`demo-console-state ${consoleStatusTone(status)}`}>{status}</span>
          </div>
          <div className="demo-console-tabs" role="tablist" aria-label="Nội dung console">
            {(["request", "response", "headers"] as const).map((value) => (
              <button
                aria-selected={tab === value}
                className={tab === value ? "active" : ""}
                key={value}
                onClick={() => setTab(value)}
                role="tab"
                type="button"
              >
                {value === "request" ? "Request" : value === "response" ? "Response" : "Headers"}
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
            {traceNote ?? (mode === "mock"
              ? "Mock chạy trong trình duyệt, không gọi API chấm. API key luôn được ẩn trong trace."
              : "Live gửi qua AIHUB BFF tới Sandbox đã ghim host; API key được ẩn trong trace.")}
          </p>
        </aside>
      </section>
    </main>
  );
}
