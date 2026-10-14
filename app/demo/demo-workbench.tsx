"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  DEMO_ENVIRONMENTS,
  demoInterfaceEnvironmentLabel,
  type DemoEnvironment,
} from "@/lib/demo-environments";
import {
  DEMO_EXPORT_FORMATS,
  DEMO_EXPORT_KEY_ENV,
  type DemoExports,
} from "@/lib/demo-export";
import { isEndUserId } from "@/lib/end-user-id";
import type { SandboxAllowanceSnapshot } from "./demo-session-state";

export const DEMO_STEPS = [
  "Kiểm tra mã API",
  "Chọn đề bài",
  "Chuẩn bị câu trả lời",
  "Chấm và xem kết quả",
] as const;

export type DemoStep = 1 | 2 | 3 | 4;
export type DemoConsoleTab = "request" | "response";
export type DemoExportFormat = keyof DemoExports;

type DemoWorkbenchProps = {
  skill: "scoring" | "speaking";
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
  exportsContainApiKey?: boolean;
  overview?: ReactNode;
  children: ReactNode;
};

const STEP_SUMMARY = [
  "Nhập mã API để sửa bài và chấm thật, hoặc bỏ qua để xem bài mẫu.",
  "Chọn đề bài để làm thử.",
  "Nhập bài viết hoặc chuẩn bị câu trả lời bằng giọng nói.",
  "Xem điểm và nhận xét.",
];

export function DemoUserIdentityField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="demo-field">
      <label htmlFor={id}>Mã người dùng của ứng dụng (X-User-Identity)</label>
      <input
        autoComplete="off"
        disabled={disabled}
        id={id}
        maxLength={256}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Tự tạo mã ngẫu nhiên"
        spellCheck={false}
        type="text"
        value={value}
      />
      <p className="demo-help">
        Mã ngẫu nhiên được tạo sẵn. Bạn có thể thay bằng ID người dùng trong ứng
        dụng của mình; không dùng email, tên hoặc số điện thoại.
      </p>
      <p className="demo-help">
        Nếu tổ chức yêu cầu mã người dùng có chữ ký từ máy chủ, bản thử này
        không thể thay máy chủ tạo chữ ký đó. Đăng nhập AIHUB hoặc nhập ID thông
        thường cũng không thay thế được; hãy gửi yêu cầu từ máy chủ của bạn.
      </p>
      {value.length > 0 && !isEndUserId(value) && (
        <p className="demo-error" role="alert">
          Mã cần có 1–256 ký tự, không chứa khoảng trắng.
        </p>
      )}
    </div>
  );
}

function consoleStatusTone(status: string) {
  if (/^HTTP 2\d\d|đã chấm thật|đã nhận kết quả/i.test(status)) return "live";
  if (
    /HTTP [45]\d\d|FAILED|INVALID|ERROR|NO HTTP RESPONSE|chưa hợp lệ|chưa thành công|có lỗi/i.test(
      status
    )
  )
    return "error";
  if (
    /MOCK|LOCAL|SIMULATED|FIXTURE|PREVIEW|NOT SENT|OPTIONAL|SKIPPED|READ-ONLY|bài mẫu|kết quả mẫu|chưa gửi/i.test(
      status
    )
  )
    return "mock";
  return "";
}

function displayStatus(status: string) {
  if (/^HTTP 2\d\d/.test(status)) return "Đã nhận kết quả";
  if (/^HTTP [45]\d\d/.test(status)) return "Gửi chưa thành công";
  if (/NO HTTP RESPONSE/.test(status)) return "Chưa nhận được kết quả";
  if (/CHECKING KEY/.test(status)) return "Đang kiểm tra mã API";
  if (/CHECK FAILED|KEY INVALID/.test(status)) return "Mã API chưa hợp lệ";
  if (/LOADING QUESTIONS/.test(status)) return "Đang tải câu hỏi";
  if (/LIVE CATALOG/.test(status)) return "Đã tải câu hỏi";
  if (/GRADING/.test(status)) return "Đang chấm bài";
  if (/^Đang chấm/.test(status)) return status;
  if (
    /KẾT QUẢ MẪU|MOCK|LOCAL|SIMULATED|FIXTURE|PREVIEW|NOT SENT|OPTIONAL|SKIPPED|READ-ONLY/.test(
      status
    )
  )
    return "Đang xem kết quả mẫu";
  if (/READY/.test(status)) return "Sẵn sàng";
  if (/^[A-Z][A-Z_]+$/.test(status)) return "Có lỗi khi xử lý";
  return status;
}

export function DemoWorkbench({
  skill,
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
  exportsContainApiKey = false,
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
          <Link href="/demo">Danh sách bài thử</Link>
          <span aria-hidden="true">/</span>
          <span>{title}</span>
        </div>
      )}

      <header className="demo-flow-hero">
        <div>
          <p className="demo-flow-eyebrow">
            AIHUB ·{" "}
            {environment === "sandbox"
              ? "DÙNG THỬ MIỄN PHÍ"
              : "MÔI TRƯỜNG THẬT · CÓ THỂ TÍNH PHÍ"}
          </p>
          <h1>{title}</h1>
          <p className="demo-flow-lede">{description}</p>
        </div>
        <div className="demo-flow-statuses">
          <span className={`demo-mode-badge ${mode}`}>
            <i aria-hidden="true" />{" "}
            {mode === "live"
              ? environment === "sandbox"
                ? "Chấm thật · Dùng thử"
                : "Chấm thật · Có thể tính phí"
              : "Kết quả mẫu có sẵn"}
          </span>
        </div>
        <nav className="demo-skill-switch" aria-label="Chọn kỹ năng">
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
              <p className="demo-flow-eyebrow">GIỚI THIỆU</p>
              <h2 id="demo-overview-title">Các bước gửi bài và nhận kết quả</h2>
            </div>
            <a href="#demo-steps">Đến phần thực hành ↗</a>
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
                ? "Đã kiểm tra mã · có thể sửa bài"
                : "Đang xem bài mẫu"}
            </span>
          </div>
          <nav aria-label="Các bước thực hành">
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
                  <legend>Nơi chấm bài</legend>
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
                      {demoInterfaceEnvironmentLabel(value)}
                    </label>
                  ))}
                  <p className="demo-help">
                    Dùng thử miễn phí trong số lượt cho phép. Môi trường thật có
                    thể tính phí; hệ thống tự chọn nơi phù hợp với mã API.
                  </p>
                </fieldset>
              )}
              {stepperDisabled && (
                <p className="demo-notice" role="status">
                  Đang chấm bài. Đợi xong rồi mới đổi mã API hoặc nơi chấm.
                </p>
              )}
              {environment === "sandbox" && sandboxAllowance !== undefined && (
                <div className="demo-notice" data-testid="sandbox-allowance">
                  {sandboxAllowance ? (
                    <>
                      Tổ chức của bạn đã dùng {sandboxAllowance.reserved}/
                      {sandboxAllowance.monthlyLimit} lượt chấm miễn phí trong
                      tháng. Đây là số liệu lúc kiểm tra mã; số lượt còn lại sẽ
                      được cập nhật khi kiểm tra lại.
                    </>
                  ) : (
                    <>
                      Chưa đọc được số lượt chấm miễn phí của tổ chức bạn. Số
                      lượt sẽ được kiểm tra lại khi chấm.
                    </>
                  )}
                </div>
              )}
              {environment === "production" && (
                <div className="demo-notice demo-billable">
                  {productionKeyValidated && (
                    <p data-testid="production-key-warning" role="status">
                      Mã API dùng cho môi trường tính phí đã được xác nhận. Mỗi
                      lần chấm có thể phát sinh chi phí cho tổ chức của bạn.
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
                    Tôi hiểu mỗi lần chấm trên môi trường tính phí có thể phát
                    sinh chi phí thật cho tổ chức của mình.
                  </label>
                  <p className="demo-help">
                    Xác nhận này áp dụng cho lần chấm đầu tiên trong phiên và sẽ
                    được yêu cầu lại khi bạn đổi mã API hoặc nơi chấm. AIHUB sẽ
                    kiểm tra lại số lượt và chi phí khi bạn gửi bài.
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
            aria-label="Thông tin gửi đi và kết quả của bước hiện tại"
          >
            <div className="demo-console-heading">
              <div>
                <p className="demo-flow-eyebrow">CHI TIẾT TÙY CHỌN</p>
                <h2>Thông tin gửi đi / Kết quả</h2>
              </div>
              <span
                className={`demo-console-state ${consoleStatusTone(status)}`}
              >
                {displayStatus(status)}
              </span>
            </div>
            <div
              className="demo-console-tabs"
              role="tablist"
              aria-label="Chọn thông tin cần xem"
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
                  {value === "request"
                    ? "Thông tin gửi đi"
                    : "Kết quả nhận được"}
                </button>
              ))}
              <button
                className="demo-console-copy"
                onClick={copy}
                type="button"
              >
                {copied ? "Đã sao chép" : "Sao chép"}
              </button>
            </div>
            <pre className="demo-console-code" role="tabpanel" tabIndex={0}>
              <code>{output}</code>
            </pre>
            <p className="demo-console-note">
              {traceNote ??
                (mode === "mock"
                  ? "Đây là thông tin minh họa; bài không được gửi đi chấm."
                  : "Thông tin gửi đi mô tả yêu cầu chấm hiện tại.")}
            </p>
          </aside>
        )}
      </section>

      {exports && (
        <section
          className="demo-exports"
          aria-label="Sao chép lệnh dùng ở công cụ khác"
        >
          <div className="demo-section-title">
            <div>
              <p className="demo-flow-eyebrow">SAO CHÉP</p>
              <h2>Sao chép lệnh để dùng ở công cụ khác</h2>
            </div>
          </div>
          <div
            className="demo-console-tabs"
            role="tablist"
            aria-label="Chọn loại lệnh cần sao chép"
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
              {exportCopied ? "Đã sao chép" : "Sao chép"}
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
              "Lệnh mẫu dùng bản ghi âm có sẵn. Nếu muốn gửi bản ghi của mình, hãy chọn Bash hoặc PowerShell."}{" "}
            {exportFormat === "prompt"
              ? "Dán hướng dẫn vào ChatGPT hoặc công cụ lập trình AI để soạn lệnh Bash, PowerShell hoặc Postman. Hướng dẫn chỉ tạo lệnh, không tự gửi bài và không chứa mã API của bạn."
              : exportsContainApiKey
                ? "Lệnh này có chứa mã API của bạn. Hãy giữ kín nội dung đã sao chép."
                : exportFormat === "postman"
                  ? "Trong Postman, chọn Import (Nhập) và dán lệnh đã sao chép. Điền mã API vào ô aihub_api_key trước khi gửi. Lệnh này không chứa mã API của bạn."
                  : exportFormat === "powershell"
                    ? `Lệnh chưa chứa mã API. Trước khi chạy, hãy điền mã vào biến $env:${DEMO_EXPORT_KEY_ENV} trong PowerShell.`
                    : `Lệnh chưa chứa mã API. Hãy điền mã vào biến ${DEMO_EXPORT_KEY_ENV} trong cửa sổ lệnh trước khi chạy.`}
          </p>
        </section>
      )}
    </main>
  );
}
