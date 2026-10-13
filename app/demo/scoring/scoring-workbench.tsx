"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MOCK_WRITING_RESULTS } from "@/data/demo-grading-fixtures";
import { WRITING_DEMO_PROMPTS } from "@/data/writing-demo-prompts";
import {
  isWritingGradingEnvelope,
  type WritingGradingEnvelope,
} from "@/data/scoring-response";
import {
  isFetchableImageUrl,
  WRITING_TASK1_CHART_TYPES,
} from "@/data/writing-task1-request";
import { demoEnvironmentName } from "@/lib/demo-environments";
import { buildDemoExports } from "@/lib/demo-export";
import { useDemoSession, type DemoScope } from "@/app/demo/demo-session";
import { sandboxAllowanceFrom } from "@/app/demo/demo-session-state";
import {
  DEMO_STEPS,
  DemoWorkbench,
  type DemoStep,
} from "@/app/demo/demo-workbench";
import {
  CLIENT_BUDGET_SECONDS,
  errorFromPayload,
  SAMPLE_DRAFT,
} from "./scoring-client";
import type { Draft, PublicError } from "./scoring-client";
import { GradeReport } from "./scoring-report";

const SCOPE: DemoScope = "writing.grade";
const TASKS = [1, 2] as const;

const SCENARIOS = [
  {
    id: "revoked",
    label: "Key bị thu hồi",
    status: "401 Unauthorized",
    request: {
      method: "POST",
      headers: { "X-API-Key": "[REDACTED]", "X-User-Identity": "<demo UUID>" },
    },
    response: {
      error: {
        code: "UNAUTHORIZED",
        message: "API key không hợp lệ hoặc đã bị thu hồi.",
        retryable: false,
      },
    },
  },
  {
    id: "scope",
    label: "Thiếu writing.grade",
    status: "403 Forbidden",
    request: {
      method: "POST",
      headers: { "X-API-Key": "[REDACTED]" },
      body: { task: 1 },
    },
    response: {
      error: {
        code: "FORBIDDEN",
        message: "API key không được phép dùng cho thao tác này.",
        retryable: false,
      },
    },
  },
  {
    id: "quota",
    label: "Hết hạn mức môi trường",
    status: "429 Too Many Requests",
    request: {
      method: "POST",
      headers: { "X-API-Key": "[REDACTED]" },
      body: { task: 1 },
    },
    response: {
      error: {
        code: "QUOTA_EXCEEDED",
        message: "Môi trường đã hết hạn mức tháng.",
        retryable: false,
      },
    },
  },
  {
    id: "timeout",
    label: "Chấm quá thời gian",
    status: "504 Gateway Timeout",
    request: {
      method: "POST",
      headers: { "X-API-Key": "[REDACTED]" },
      body: { task: 1 },
    },
    response: {
      error: {
        code: "AI_SERVICE_TIMEOUT",
        message: "Dịch vụ chấm mất quá lâu.",
        retryable: true,
      },
    },
  },
] as const;

type GradeResult = {
  task: 1 | 2;
  essay: string;
  envelope: WritingGradingEnvelope;
  mode: "mock" | "live";
};
type HttpTrace = {
  status: number;
  contentType: string | null;
  cacheControl: string | null;
};

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function httpTrace(response: Response): HttpTrace {
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    cacheControl: response.headers.get("cache-control"),
  };
}

function httpSummary(trace: HttpTrace | null) {
  return trace
    ? `HTTP ${trace.status}\nContent-Type: ${trace.contentType ?? "(not returned)"}\nCache-Control: ${trace.cacheControl ?? "(not returned)"}`
    : "No HTTP response headers received.";
}

export default function ScoringWorkbench() {
  const {
    state,
    grading,
    beginGrading,
    endGrading,
    setApiKey,
    setEnvironment,
    selectionGeneration,
    isSelectionCurrent,
    isScopeValidated,
    markScopeValidated,
    clearScopeValidation,
    requiresProductionAcknowledgement,
    acknowledgeProduction,
    getUserIdentity,
  } = useDemoSession();
  const apiKey = state.apiKey;
  const environment = state.environment;
  const [task, setTask] = useState<1 | 2>(1);
  const [drafts, setDrafts] = useState<Record<1 | 2, Draft>>(SAMPLE_DRAFT);
  const [mockPromptIndexes, setMockPromptIndexes] = useState<
    Record<1 | 2, number>
  >({
    1: 0,
    2: 0,
  });
  const [step, setStep] = useState<DemoStep>(1);
  const [skipMock, setSkipMock] = useState(false);
  const [checkingKey, setCheckingKey] = useState(false);
  const [keyCheckResponse, setKeyCheckResponse] = useState<unknown>(null);
  const [keyCheckTrace, setKeyCheckTrace] = useState<HttpTrace | null>(null);
  const [keyError, setKeyError] = useState<PublicError | null>(null);
  const [gradeStatus, setGradeStatus] = useState<"idle" | "submitting">("idle");
  const [gradeError, setGradeError] = useState<PublicError | null>(null);
  const [gradeResponse, setGradeResponse] = useState<unknown>(null);
  const [gradeTrace, setGradeTrace] = useState<HttpTrace | null>(null);
  const [gradeAttempted, setGradeAttempted] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [scenario, setScenario] =
    useState<(typeof SCENARIOS)[number]["id"]>("revoked");
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  const draft = drafts[task];
  const setDraft = (patch: Partial<Draft>) => {
    setIdempotencyKey(globalThis.crypto.randomUUID());
    setDrafts((current) => ({
      ...current,
      [task]: { ...current[task], ...patch },
    }));
    setGradeError(null);
    setGradeResponse(null);
    setGradeTrace(null);
    setGradeAttempted(false);
    setResult(null);
  };
  const liveReady =
    apiKey.trim().length > 0 && isScopeValidated(SCOPE) && !skipMock;
  const mode = liveReady ? "live" : "mock";
  const activeDraft = useMemo(
    () =>
      liveReady
        ? draft
        : {
            ...SAMPLE_DRAFT[task],
            question:
              WRITING_DEMO_PROMPTS[task][mockPromptIndexes[task]] ??
              WRITING_DEMO_PROMPTS[task][0],
          },
    [draft, liveReady, mockPromptIndexes, task]
  );
  const requestBody = useMemo(
    () =>
      task === 1
        ? {
            task,
            question: activeDraft.question,
            essay: activeDraft.essay,
            chart_type: activeDraft.chartType,
            image_url: activeDraft.imageUrl,
          }
        : {
            task,
            question: activeDraft.question,
            essay: activeDraft.essay,
            topic: activeDraft.topic,
          },
    [task, activeDraft]
  );
  /** Every copyable artifact describes the AIHUB call, so Mock offers it too. */
  const copyableExports = useMemo(
    () =>
      step === 1
        ? null
        : buildDemoExports({
            environment,
            skill: "writing",
            title: `Writing Task ${task}`,
            path: `/v1/ielts/writing/task${task}/grade`,
            headers: [
              { name: "X-User-Identity", value: "<your end-user id>" },
              { name: "Content-Type", value: "application/json" },
            ],
            body: requestBody,
            idempotencyKey: idempotencyKey ?? undefined,
          }),
    [environment, idempotencyKey, requestBody, step, task]
  );
  const activeScenario =
    SCENARIOS.find((item) => item.id === scenario) ?? SCENARIOS[0];
  const activeResult = result?.task === task ? result : null;
  /** Informational only: every grade re-checks the allowance upstream. */
  const allowance = isScopeValidated(SCOPE)
    ? sandboxAllowanceFrom(keyCheckResponse)
    : undefined;
  const chartProblem =
    task === 1 && !isFetchableImageUrl(activeDraft.imageUrl ?? "")
      ? "Task 1 cần image_url HTTPS có thể tải được."
      : null;

  const selectMockPrompt = (index: number) => {
    setMockPromptIndexes((current) => ({ ...current, [task]: index }));
    setIdempotencyKey(globalThis.crypto.randomUUID());
    setGradeError(null);
    setGradeResponse(null);
    setGradeTrace(null);
    setGradeAttempted(false);
    setResult(null);
  };

  useEffect(() => {
    if (gradeStatus !== "submitting") return;
    const timer = window.setInterval(
      () => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [gradeStatus]);

  const validateKey = async () => {
    const submittedKey = apiKey.trim();
    const submittedEnvironment = environment;
    const submittedGeneration = selectionGeneration();
    if (!submittedKey) {
      setKeyError({
        code: "UNAUTHORIZED",
        message: `Nhập API key ${demoEnvironmentName(environment)} hoặc bỏ qua để dùng mẫu.`,
      });
      return;
    }
    setCheckingKey(true);
    setKeyError(null);
    setSkipMock(false);
    setKeyCheckTrace(null);
    setKeyCheckResponse({ state: "pending", scope: SCOPE });
    let receivedTrace: HttpTrace | null = null;
    try {
      const response = await fetch("/api/demo/key/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Demo-API-Key": submittedKey,
        },
        body: JSON.stringify({
          environment: submittedEnvironment,
          scope: SCOPE,
        }),
        cache: "no-store",
      });
      // A changed key or environment discards the answer to this question.
      if (
        !isSelectionCurrent(
          submittedKey,
          submittedEnvironment,
          submittedGeneration
        )
      )
        return;
      receivedTrace = httpTrace(response);
      setKeyCheckTrace(receivedTrace);
      const payload: unknown = await response.json().catch(() => null);
      if (
        !isSelectionCurrent(
          submittedKey,
          submittedEnvironment,
          submittedGeneration
        )
      )
        return;
      setKeyCheckResponse(payload);
      if (!response.ok) throw errorFromPayload(payload);
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("data" in payload) ||
        typeof payload.data !== "object" ||
        payload.data === null ||
        !("valid" in payload.data) ||
        payload.data.valid !== true
      ) {
        throw {
          code: "AI_SERVICE_CONTRACT_VIOLATION",
          message: "Response kiểm tra key không đúng định dạng.",
        } satisfies PublicError;
      }
      markScopeValidated(SCOPE);
      setIdempotencyKey(globalThis.crypto.randomUUID());
      setStep(2);
    } catch (caught) {
      if (
        !isSelectionCurrent(
          submittedKey,
          submittedEnvironment,
          submittedGeneration
        )
      )
        return;
      clearScopeValidation();
      const publicError =
        typeof caught === "object" &&
        caught !== null &&
        "code" in caught &&
        "message" in caught
          ? (caught as PublicError)
          : {
              code: "AI_SERVICE_UNAVAILABLE",
              message: "Không kiểm tra được key. Thử lại hoặc dùng mẫu.",
            };
      setKeyError(publicError);
      if (!receivedTrace) {
        setKeyCheckResponse({
          error: { code: publicError.code, message: publicError.message },
          http_response: null,
        });
      }
    } finally {
      setCheckingKey(false);
    }
  };

  const useMock = () => {
    clearScopeValidation();
    setSkipMock(true);
    setKeyError(null);
    setGradeError(null);
    setGradeResponse(null);
    setGradeTrace(null);
    setGradeAttempted(false);
    setResult(null);
    setKeyCheckTrace(null);
    setKeyCheckResponse({
      mode: "mock",
      request: null,
      message: "Live validation cleared; fixed fixture selected without HTTP.",
    });
    setIdempotencyKey(globalThis.crypto.randomUUID());
    setStep(2);
  };

  const grade = async () => {
    setGradeError(null);
    setResult(null);
    if (!liveReady) {
      setGradeAttempted(false);
      setGradeTrace(null);
      const envelope = MOCK_WRITING_RESULTS[task];
      setGradeResponse(envelope);
      setResult({ task, essay: activeDraft.essay, envelope, mode: "mock" });
      return;
    }
    if (chartProblem) {
      setGradeError({ code: "INVALID_REQUEST", message: chartProblem });
      return;
    }
    // The first Production grade of a visit needs the billable acknowledgement;
    // it is not a spend cap, only a gate the backend still enforces afterwards.
    if (requiresProductionAcknowledgement()) {
      setGradeError({
        code: "PRODUCTION_ACKNOWLEDGEMENT_REQUIRED",
        message:
          "Xác nhận ở khung “Môi trường demo” rằng request Production có thể tính phí trước khi chấm.",
      });
      return;
    }
    if (!beginGrading()) return;

    const submissionKey =
      result?.mode === "live" || !idempotencyKey
        ? globalThis.crypto.randomUUID()
        : idempotencyKey;
    setIdempotencyKey(submissionKey);

    setGradeStatus("submitting");
    setGradeAttempted(true);
    setGradeTrace(null);
    setGradeResponse({
      state: "pending",
      request: "POST /v1/ielts/writing/task" + task + "/grade",
    });
    setElapsed(0);
    startedAt.current = Date.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      CLIENT_BUDGET_SECONDS * 1000
    );
    let receivedTrace: HttpTrace | null = null;
    try {
      const response = await fetch("/api/demo/scoring/grade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Demo-API-Key": apiKey.trim(),
          "X-Demo-Environment": environment,
          "X-Demo-User-Identity": getUserIdentity(),
          "Idempotency-Key": submissionKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        cache: "no-store",
      });
      receivedTrace = httpTrace(response);
      setGradeTrace(receivedTrace);
      const payload: unknown = await response.json().catch(() => null);
      setGradeResponse(payload);
      if (!response.ok) throw errorFromPayload(payload);
      if (!isWritingGradingEnvelope(payload)) {
        throw {
          code: "AI_SERVICE_CONTRACT_VIOLATION",
          message: "Kết quả từ AIHUB không đúng định dạng.",
        } satisfies PublicError;
      }
      setResult({ task, essay: draft.essay, envelope: payload, mode: "live" });
    } catch (caught) {
      const publicError =
        typeof caught === "object" &&
        caught !== null &&
        "code" in caught &&
        "message" in caught
          ? (caught as PublicError)
          : controller.signal.aborted
            ? {
                code: "AI_SERVICE_TIMEOUT",
                message: `Yêu cầu vượt ${CLIENT_BUDGET_SECONDS} giây.`,
              }
            : {
                code: "AI_SERVICE_UNAVAILABLE",
                message:
                  "Không gửi được yêu cầu. Kiểm tra kết nối rồi thử lại.",
              };
      setGradeError(publicError);
      if (!receivedTrace)
        setGradeResponse({
          error: { code: publicError.code, message: publicError.message },
          http_response: null,
        });
    } finally {
      window.clearTimeout(timeout);
      setGradeStatus("idle");
      endGrading();
    }
  };

  const requestForStep = () => {
    if (step === 1)
      return pretty(
        skipMock
          ? {
              source: "local choice",
              http_request: null,
              message: "Đã bỏ qua kiểm tra key.",
            }
          : {
              source: keyCheckResponse
                ? "request sent"
                : apiKey.trim()
                  ? "preview · not sent"
                  : "key optional · not sent",
              browser_to_aihub_bff: {
                method: "POST",
                path: "/api/demo/key/validate",
                headers: {
                  "X-Demo-API-Key": apiKey.trim() ? "[REDACTED]" : "(not set)",
                  "Content-Type": "application/json",
                },
                body: { scope: SCOPE },
              },
              bff_to_selected_environment: {
                environment: demoEnvironmentName(environment),
                method: "POST",
                path: "/v1/sandbox/demo/api-keys/validate",
                headers: {
                  "X-API-Key": "[REDACTED]",
                  "Content-Type": "application/json",
                },
                body: { scope: SCOPE },
              },
            }
      );
    if (step === 2)
      return pretty({
        source: "local fixture",
        http_request: null,
        selection: {
          task,
          question: activeDraft.question,
          ...(task === 1
            ? {
                chart_type: activeDraft.chartType,
                image_url: activeDraft.imageUrl,
              }
            : { topic: activeDraft.topic }),
        },
      });
    if (step === 5)
      return pretty({
        source: "local error scenario · simulated, no HTTP",
        scenario: activeScenario.label,
        simulated_request: activeScenario.request,
      });
    if (step === 3)
      return pretty({
        source: liveReady
          ? "local draft preview · not sent"
          : "read-only fixture · not sent",
        planned_request: liveReady
          ? {
              method: "POST",
              browser_to_aihub_bff: "/api/demo/scoring/grade",
              bff_to_selected_environment: {
                environment: demoEnvironmentName(environment),
                path: `/v1/ielts/writing/task${task}/grade`,
              },
              headers: {
                "X-Demo-API-Key": "[REDACTED]",
                "X-Demo-User-Identity": "<generated at submit>",
                "Content-Type": "application/json",
                "Idempotency-Key":
                  idempotencyKey ?? "<generated before submit>",
              },
            }
          : null,
        body_preview: requestBody,
        sent: false,
      });
    if (!liveReady)
      return pretty({
        source: "local fixed fixture",
        http_request: null,
        message: "Submit chỉ trả kết quả mock cố định trong frontend.",
      });
    return pretty({
      source: gradeAttempted
        ? "request sent via AIHUB BFF"
        : "request preview · not sent",
      method: "POST",
      browser_to_aihub_bff: "/api/demo/scoring/grade",
      bff_to_selected_environment: {
        environment: demoEnvironmentName(environment),
        path: `/v1/ielts/writing/task${task}/grade`,
      },
      headers: {
        "X-Demo-API-Key": "[REDACTED]",
        "X-Demo-User-Identity": gradeAttempted
          ? getUserIdentity()
          : "<generated at submit>",
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey ?? "<generated before submit>",
      },
      body: requestBody,
      sent: gradeAttempted,
    });
  };

  const responseForStep = () => {
    if (step === 1)
      return skipMock
        ? pretty({
            source: "local choice",
            http_response: null,
            message: "Đã bỏ qua kiểm tra key.",
          })
        : keyCheckResponse
          ? pretty({
              http: keyCheckTrace
                ? {
                    status: keyCheckTrace.status,
                    headers: httpSummary(keyCheckTrace),
                  }
                : null,
              body: keyCheckResponse,
            })
          : pretty({
              http_response: null,
              message: "Chưa kiểm tra key; chưa có response.",
            });
    if (step === 2)
      return pretty({
        source: "local fixture",
        http_response: null,
        task,
        question: activeDraft.question,
        ...(task === 1
          ? {
              chart_type: activeDraft.chartType,
              image_url: activeDraft.imageUrl,
            }
          : { topic: activeDraft.topic }),
      });
    if (step === 3)
      return pretty({
        source: "local draft preview",
        http_response: null,
        message: "Chưa gửi request. Payload preview nằm ở tab Request.",
      });
    if (step === 5)
      return pretty({
        source: "local simulation · no HTTP",
        simulated_status: activeScenario.status,
        simulated_response: activeScenario.response,
      });
    if (!liveReady)
      return gradeResponse
        ? pretty({
            source: "local fixed fixture",
            http_response: null,
            body: gradeResponse,
          })
        : pretty({
            source: "local fixed fixture",
            http_response: null,
            message: "Chưa submit fixture mẫu.",
          });
    return gradeResponse
      ? pretty({
          http: gradeTrace
            ? { status: gradeTrace.status, headers: httpSummary(gradeTrace) }
            : null,
          body: gradeResponse,
        })
      : pretty({
          http_response: null,
          message:
            gradeStatus === "submitting"
              ? "Request đang chạy; chưa nhận response."
              : "Chưa gửi request.",
        });
  };

  const requestHeaders =
    step === 1
      ? skipMock || (!apiKey.trim() && !keyCheckResponse)
        ? "No HTTP request — key check skipped or not started."
        : `${keyCheckResponse ? "Sent" : "Preview only; not sent"}\nBrowser → AIHUB BFF: X-Demo-API-Key: ${apiKey.trim() ? "[REDACTED]" : "(not set)"}\nContent-Type: application/json\nBFF → ${demoEnvironmentName(environment)}: X-API-Key: [REDACTED]\nContent-Type: application/json`
      : step === 3 || (step === 4 && !liveReady)
        ? "No HTTP request — local preview/mock."
        : step === 4
          ? `${gradeAttempted ? "Sent" : "Preview only; not sent"}\nBrowser → AIHUB BFF: X-Demo-API-Key: [REDACTED]\nX-Demo-User-Identity: ${gradeAttempted ? getUserIdentity() : "<generated at submit>"}\nContent-Type: application/json\nIdempotency-Key: ${idempotencyKey ?? "<generated before submit>"}\nBFF → ${demoEnvironmentName(environment)}: X-API-Key: [REDACTED]\nX-User-Identity: <demo UUID>`
          : step === 5
            ? "Simulated request only — no request headers were sent."
            : "No HTTP request — local fixture.";
  const responseHeaders =
    step === 1
      ? keyCheckTrace
        ? httpSummary(keyCheckTrace)
        : "No HTTP response headers received."
      : step === 4 && liveReady
        ? httpSummary(gradeTrace)
        : step === 5
          ? "No HTTP response headers — simulated status only."
          : "No HTTP response headers — local preview/fixture.";
  const consoleRequest = requestForStep();
  const consoleResponse = responseForStep();

  return (
    <DemoWorkbench
      skill="scoring"
      scope={SCOPE}
      title="Chấm điểm IELTS Writing"
      description={`Thử Writing Task 1 và Task 2 theo đúng API contract. Bỏ qua key để xem fixture read-only; key ${demoEnvironmentName(environment)} hợp lệ mở chỉnh sửa và chấm thật.`}
      step={step}
      onStepChange={setStep}
      stepperDisabled={grading || gradeStatus === "submitting"}
      mode={mode}
      status={
        gradeStatus === "submitting"
          ? `Đang chấm · ${elapsed}s`
          : activeResult
            ? activeResult.mode === "mock"
              ? "KẾT QUẢ MẪU"
              : "LIVE RESPONSE"
            : (gradeError?.code ?? (keyError ? "KEY INVALID" : "READY"))
      }
      request={consoleRequest}
      response={consoleResponse}
      requestHeaders={requestHeaders}
      responseHeaders={responseHeaders}
      environment={environment}
      onEnvironmentChange={(value) => {
        setEnvironment(value);
        setIdempotencyKey(globalThis.crypto.randomUUID());
      }}
      productionAcknowledged={state.productionAcknowledged}
      requiresProductionAcknowledgement={requiresProductionAcknowledgement()}
      onAcknowledgeProduction={acknowledgeProduction}
      sandboxAllowance={allowance}
      exports={copyableExports}
      traceNote={
        step === 1
          ? "Key validation checks the selected environment, scope and Organization identity configuration. It does not dispatch grading or consume grading quota. The key is redacted."
          : step === 2
            ? "Writing Task 1/2 use local fixed prompts. No HTTP request is sent."
            : step === 3
              ? "This is a local payload preview. The essay is sent only after the Step 4 button is pressed."
              : step === 4
                ? liveReady
                  ? `Every live grading request reauthenticates the ${demoEnvironmentName(environment)} key before quota and AI dispatch; trace redacts the key.`
                  : "The button returns a fixed frontend fixture. No grading API request is sent."
                : "Error scenarios are simulated locally. No HTTP request or quota use."
      }
    >
      <p className="demo-flow-eyebrow">
        BƯỚC {step} / 5 · {DEMO_STEPS[step - 1]}
      </p>

      {step === 1 && (
        <>
          <h3>Chọn môi trường và key</h3>
          <p>
            API key chỉ nằm trong bộ nhớ của trang. Key được kiểm tra theo scope{" "}
            <code>{SCOPE}</code> và theo môi trường đã chọn, không gọi AI và
            không dùng quota chấm.
          </p>
          <div className="demo-field">
            <label htmlFor="writing-demo-key">
              API key {demoEnvironmentName(environment)} (tùy chọn)
            </label>
            <input
              autoComplete="off"
              disabled={grading}
              id="writing-demo-key"
              onChange={(event) => {
                setApiKey(event.target.value);
                setIdempotencyKey(globalThis.crypto.randomUUID());
                setSkipMock(false);
                setKeyError(null);
                setKeyCheckResponse(null);
                setKeyCheckTrace(null);
                setGradeError(null);
                setGradeResponse(null);
                setGradeTrace(null);
                setGradeAttempted(false);
                setResult(null);
              }}
              placeholder={
                environment === "sandbox" ? "aihub_sandbox_…" : "aihub_prod_…"
              }
              spellCheck={false}
              type="password"
              value={apiKey}
            />
            <p className="demo-help">
              Chỉ key thuộc riêng môi trường {demoEnvironmentName(environment)}{" "}
              và có scope writing.grade mới mở chế độ chấm thật.
            </p>
          </div>
          {keyError && (
            <div className="demo-error" role="alert">
              <strong>{keyError.code}</strong> · {keyError.message}
            </div>
          )}
          {isScopeValidated(SCOPE) && apiKey && (
            <div className="demo-success">
              Key đã qua kiểm tra bước 1. Mỗi lần chấm vẫn được BE xác thực lại.
            </div>
          )}
          <div className="demo-step-actions">
            <button
              className="demo-btn-primary"
              disabled={grading || checkingKey || !apiKey.trim()}
              onClick={validateKey}
              type="button"
            >
              {checkingKey ? "Đang kiểm tra · " : null}Kiểm tra key
            </button>
            <button
              className="demo-btn-secondary"
              disabled={grading || checkingKey}
              onClick={useMock}
              type="button"
            >
              Bỏ qua, dùng mẫu
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h3>Chọn bài Writing</h3>
          <p>
            Mỗi task có 3 đề mẫu cố định. Ở mock mode, chọn đề chỉ đổi question;
            bài làm và kết quả vẫn là fixture read-only chung của task.
          </p>
          <div
            className="demo-inline-actions"
            role="tablist"
            aria-label="Writing task"
          >
            {TASKS.map((value) => (
              <button
                aria-selected={task === value}
                className={`demo-btn-secondary ${task === value ? "active" : ""}`}
                data-testid={`tab-task-${value}`}
                key={value}
                onClick={() => {
                  setTask(value);
                  setIdempotencyKey(globalThis.crypto.randomUUID());
                  setResult(null);
                  setGradeError(null);
                  setGradeResponse(null);
                  setGradeTrace(null);
                  setGradeAttempted(false);
                }}
                role="tab"
                type="button"
              >
                Task {value}
              </button>
            ))}
          </div>
          {task === 1 && (
            <>
              <div className="demo-field">
                <label htmlFor="writing-chart-type">chart_type</label>
                <select
                  data-testid="select-chart-type"
                  disabled={!liveReady}
                  id="writing-chart-type"
                  onChange={(event) =>
                    setDraft({ chartType: event.target.value })
                  }
                  value={activeDraft.chartType}
                >
                  {WRITING_TASK1_CHART_TYPES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <p className="demo-help">
                  Chọn đúng một trong bảy giá trị enum, phân biệt hoa thường.
                </p>
              </div>
              <div className="demo-field">
                <label htmlFor="writing-image-url">image_url</label>
                <input
                  data-testid="input-image-url"
                  disabled={!liveReady}
                  id="writing-image-url"
                  onChange={(event) =>
                    setDraft({ imageUrl: event.target.value })
                  }
                  value={activeDraft.imageUrl}
                />
                {chartProblem && liveReady && (
                  <div
                    className="demo-error"
                    data-testid="chart-url-problem"
                    role="alert"
                  >
                    {chartProblem}
                  </div>
                )}
                <p className="demo-help">
                  Dịch vụ chấm tải ảnh qua HTTPS. Dùng URL tới ảnh thật khi chấm
                  live.
                </p>
              </div>
            </>
          )}
          {task === 2 && (
            <div className="demo-field">
              <label htmlFor="writing-topic">topic</label>
              <input
                data-testid="input-topic"
                disabled={!liveReady}
                id="writing-topic"
                onChange={(event) => setDraft({ topic: event.target.value })}
                value={activeDraft.topic}
              />
              <p className="demo-help">
                Topic là text tự do theo contract, tối đa 200 ký tự.
              </p>
            </div>
          )}
          <div className="demo-field">
            <label htmlFor={liveReady ? "writing-question" : undefined}>
              {liveReady ? "question" : "Chọn một đề mẫu"}
            </label>
            {liveReady ? (
              <textarea
                data-testid="input-question"
                id="writing-question"
                onChange={(event) => setDraft({ question: event.target.value })}
                rows={4}
                value={activeDraft.question}
              />
            ) : (
              <div
                className="demo-scenario-list"
                aria-label={`Đề mẫu Writing Task ${task}`}
              >
                {WRITING_DEMO_PROMPTS[task].map((question, index) => (
                  <button
                    aria-pressed={mockPromptIndexes[task] === index}
                    className={
                      mockPromptIndexes[task] === index ? "active" : ""
                    }
                    data-testid={`writing-mock-question-${index + 1}`}
                    key={question}
                    onClick={() => selectMockPrompt(index)}
                    type="button"
                  >
                    <strong>Đề mẫu {index + 1}</strong>
                    <br />
                    <small>{question}</small>
                  </button>
                ))}
              </div>
            )}
            <p className="demo-help">
              {liveReady
                ? "Question là text tự do theo API contract."
                : "Chọn đề để xem request tương ứng. Bài làm và kết quả mẫu không thay đổi theo lựa chọn."}
            </p>
          </div>
          <div className="demo-step-actions">
            <button
              className="demo-btn-primary"
              onClick={() => {
                setIdempotencyKey(globalThis.crypto.randomUUID());
                setStep(3);
              }}
              type="button"
            >
              Tiếp tục đến bài làm
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h3>Nhập bài làm</h3>
          <p>
            {liveReady
              ? `Bạn có thể sửa bài trước khi gửi lên ${demoEnvironmentName(environment)}.`
              : "Mock mode hiển thị bài mẫu read-only; kết quả khi submit luôn là fixture cố định."}
          </p>
          <div className="demo-field">
            <label htmlFor="writing-essay">
              essay ·{" "}
              {activeDraft.essay.trim().split(/\s+/).filter(Boolean).length} từ
            </label>
            <textarea
              data-testid="input-essay"
              id="writing-essay"
              onChange={(event) => setDraft({ essay: event.target.value })}
              readOnly={!liveReady}
              rows={12}
              value={activeDraft.essay}
            />
          </div>
          <div className="demo-step-actions">
            <button
              className="demo-btn-primary"
              disabled={!activeDraft.essay.trim()}
              onClick={() => setStep(4)}
              type="button"
            >
              Xem bước chấm
            </button>
            <button
              className="demo-btn-secondary"
              onClick={() => setStep(2)}
              type="button"
            >
              Quay lại đề
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <h3>{liveReady ? "Gửi chấm live" : "Xem kết quả mẫu"}</h3>
          <p>
            {liveReady
              ? `Request sẽ dùng key ${demoEnvironmentName(environment)} đã kiểm tra và UUID tạm của phiên demo. Backend xác thực lại key trước khi dispatch.`
              : "Nút này chỉ chọn response mock cố định trong frontend. Không gọi route chấm hoặc AI service."}
          </p>
          {gradeError && (
            <div className="demo-error" role="alert">
              <strong>{gradeError.code}</strong> · {gradeError.message}
              {gradeError.retry_after_ms
                ? ` Thử lại sau ${Math.ceil(gradeError.retry_after_ms / 1000)} giây.`
                : ""}
            </div>
          )}
          <div className="demo-step-actions">
            <button
              className="demo-btn-primary"
              data-testid="button-grade"
              disabled={
                grading ||
                gradeStatus === "submitting" ||
                (liveReady && (!!chartProblem || !activeDraft.essay.trim()))
              }
              onClick={grade}
              type="button"
            >
              {gradeStatus === "submitting"
                ? `Đang chấm ${elapsed}s`
                : liveReady
                  ? `Chấm thật Task ${task}`
                  : `Hiện kết quả mẫu Task ${task}`}
            </button>
            <button
              className="demo-btn-secondary"
              disabled={grading || gradeStatus === "submitting"}
              onClick={() => setStep(3)}
              type="button"
            >
              Sửa bài
            </button>
          </div>
          {activeResult && (
            <section
              className="demo-result-card"
              aria-label="Kết quả chấm Writing"
            >
              <p className="demo-flow-eyebrow">
                {activeResult.mode === "mock"
                  ? "KẾT QUẢ MẪU CỐ ĐỊNH"
                  : "LIVE RESPONSE"}
              </p>
              <div className="demo-result-band">
                Band {activeResult.envelope.data.overall_band.toFixed(1)}
              </div>
              <p>{activeResult.envelope.data.summary}</p>
              <div className="demo-result-criteria">
                {activeResult.envelope.data.criteria.map((criterion) => (
                  <div key={criterion.id}>
                    <strong>{criterion.name}</strong>
                    <span>{criterion.band.toFixed(1)}</span>
                  </div>
                ))}
              </div>
              <ul>
                {activeResult.envelope.data.suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
          {activeResult && (
            <GradeReport
              result={activeResult.envelope}
              essay={activeResult.essay}
              task={activeResult.task}
            />
          )}
        </>
      )}

      {step === 5 && (
        <>
          <h3>Retry và lỗi</h3>
          <p>
            Các kịch bản bên dưới chỉ minh họa request/response; chọn chúng
            không gọi API chấm và không dùng quota.
          </p>
          <div className="demo-scenario-list">
            {SCENARIOS.map((item) => (
              <button
                aria-pressed={scenario === item.id}
                className={scenario === item.id ? "active" : ""}
                key={item.id}
                onClick={() => setScenario(item.id)}
                type="button"
              >
                {item.label}
                <br />
                <strong>{item.status}</strong>
              </button>
            ))}
          </div>
          <div className="demo-notice">
            Mỗi lần chấm thật là một request mới. Khi timeout, kiểm tra
            request_id trước khi bấm lại để tránh tạo lượt chấm mới.
          </div>
        </>
      )}
    </DemoWorkbench>
  );
}
