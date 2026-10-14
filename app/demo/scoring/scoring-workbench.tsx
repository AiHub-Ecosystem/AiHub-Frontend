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
import {
  demoEnvironmentHintFromApiKey,
  demoEnvironmentHost,
  demoEnvironmentName,
  demoEnvironmentRequiresSelection,
} from "@/lib/demo-environments";
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
const SCORING_STEPS = ["Kiểm tra API key", ...DEMO_STEPS.slice(1, 4)];

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

const SCORING_FLOW_STAGES = [
  {
    title: "Học viên bấm Nộp bài, app gửi đề + bài làm",
    detail:
      "App gửi đề và bài làm về server của bạn: Task 1 có chart_type, image_url; Task 2 có topic. App không giữ API key.",
    direction: "right",
  },
  {
    title: "POST …/writing/taskN/grade",
    detail:
      "N là 1 hoặc 2. Server gắn X-API-Key, X-User-Identity và Idempotency-Key cho mỗi bài làm rồi gọi AIHub. Timeout phía client tối thiểu 90 giây.",
    direction: "right",
  },
  {
    title: "Chấm 4 tiêu chí",
    detail:
      "AIHub chấm Task Achievement (Task 1) hoặc Task Response (Task 2), cùng Coherence & Cohesion, Lexical Resource và Grammatical Range & Accuracy.",
    direction: "none",
  },
  {
    title: "Trả band, criteria, annotations",
    detail:
      "Response gồm overall_band, 4 criteria theo task và annotations trích nguyên văn câu cần góp ý.",
    direction: "left",
  },
  {
    title: "Lưu kết quả, trả feedback cho app",
    detail:
      "Server lưu kết quả theo Idempotency-Key; app hiển thị band và ghim nhận xét lên đúng câu trong bài.",
    direction: "left",
  },
] as const;

function ScoringFlowOverview() {
  const [flowStep, setFlowStep] = useState(0);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [previewTask, setPreviewTask] = useState<1 | 2>(1);
  const previewDraft = SAMPLE_DRAFT[previewTask];

  useEffect(() => {
    if (flowStep < 1 || flowStep > SCORING_FLOW_STAGES.length) return;
    const timer = window.setTimeout(
      () => setFlowStep((current) => current + 1),
      1100
    );
    return () => window.clearTimeout(timer);
  }, [flowStep]);

  const activeStep =
    hoveredStep ?? (flowStep <= SCORING_FLOW_STAGES.length ? flowStep : 0);
  const explanation = activeStep
    ? {
        tag: `Bước ${activeStep}`,
        text: SCORING_FLOW_STAGES[activeStep - 1].detail,
      }
    : flowStep > SCORING_FLOW_STAGES.length
      ? {
          tag: "Xong",
          text: "Đó là toàn bộ luồng. Kéo xuống phần demo Writing để thử Task 1 hoặc Task 2 và xem request/response.",
        }
      : {
          tag: "Gợi ý",
          text: "Mô phỏng này không gửi request. Bấm “Nộp bài” để chạy luồng, hoặc rê chuột/chọn từng chặng để xem giải thích.",
        };
  const running = flowStep > 0 && flowStep <= SCORING_FLOW_STAGES.length;

  return (
    <div className="scoring-overview">
      <section aria-labelledby="scoring-overview-title">
        <div className="scoring-overview-heading">
          <span className="scoring-overview-badge">TRƯỚC TIÊN</span>
          <h2 id="scoring-overview-title">
            Luồng hoạt động chấm IELTS Writing (Task 1 &amp; Task 2)
          </h2>
          <span>Tổng quan trước khi thử demo</span>
        </div>

        <div className="scoring-overview-card">
          <article
            className={
              previewTask === 2
                ? "scoring-app-preview scoring-app-preview--compact"
                : "scoring-app-preview"
            }
            aria-label="Màn hình nộp bài mẫu"
          >
            <div className="scoring-browser-bar">
              <span className="scoring-browser-dots" aria-hidden="true">
                <i /> <i /> <i />
              </span>
              <span className="scoring-overview-mono">
                app-cua-ban.com/writing/task{previewTask}
              </span>
            </div>
            <div className="scoring-app-content">
              <p className="scoring-task-label">
                IELTS WRITING · TASK {previewTask}
              </p>
              <div
                aria-label="Chọn Task Writing minh họa"
                className="demo-inline-actions"
                role="group"
              >
                {([1, 2] as const).map((value) => (
                  <button
                    aria-pressed={previewTask === value}
                    className={`demo-btn-secondary ${previewTask === value ? "active" : ""}`}
                    key={value}
                    onClick={() => setPreviewTask(value)}
                    type="button"
                  >
                    Task {value}
                  </button>
                ))}
              </div>
              <p className="scoring-task-prompt">{previewDraft.question}</p>
              {previewTask === 1 ? (
                <div
                  aria-label="Ảnh biểu đồ đề bài (placeholder)"
                  className="scoring-chart-preview"
                  role="img"
                >
                  <span className="scoring-chart-label scoring-overview-mono">
                    [Ảnh biểu đồ · image_url]
                  </span>
                  {[0, 1, 2].map((group) => (
                    <span
                      className="scoring-chart-bars"
                      aria-hidden="true"
                      key={group}
                    >
                      <i />
                      <i />
                      <i />
                    </span>
                  ))}
                </div>
              ) : (
                <div className="scoring-topic-preview">
                  <span className="scoring-topic-label scoring-overview-mono">
                    [Chủ đề · topic]
                  </span>
                  <span className="scoring-topic-value">
                    {previewDraft.topic}
                  </span>
                </div>
              )}
              <div className="scoring-essay-preview">
                {previewDraft.essay.slice(0, 170).trimEnd()}…
              </div>
              <div className="scoring-submit-row">
                <span>Bấm để chạy toàn bộ luồng</span>
                <button
                  className="scoring-overview-submit"
                  disabled={running}
                  onClick={() => {
                    setHoveredStep(null);
                    setFlowStep(
                      window.matchMedia("(prefers-reduced-motion: reduce)")
                        .matches
                        ? SCORING_FLOW_STAGES.length + 1
                        : 1
                    );
                  }}
                  type="button"
                >
                  {running
                    ? "Đang chạy…"
                    : flowStep > SCORING_FLOW_STAGES.length
                      ? "Chạy lại"
                      : "Nộp bài"}
                </button>
              </div>
            </div>
          </article>

          <div className="scoring-sequence" aria-label="Luồng xử lý bài chấm">
            <div className="scoring-lanes" aria-hidden="true">
              <div>
                <strong>App của bạn</strong>
                <span>học viên nộp bài</span>
              </div>
              <div>
                <strong>Server của bạn</strong>
                <span>giữ API key</span>
              </div>
              <div>
                <strong>AIHub</strong>
                <span>chấm IELTS Writing</span>
              </div>
            </div>
            <div className="scoring-sequence-grid">
              {SCORING_FLOW_STAGES.map((item, index) => {
                const number = index + 1;
                const active = activeStep === number;
                const pending =
                  hoveredStep === null && running && number > flowStep;
                return (
                  <div
                    className={`scoring-flow-step scoring-flow-step--${number}`}
                    key={item.title}
                    onMouseEnter={() => setHoveredStep(number)}
                    onMouseLeave={() => setHoveredStep(null)}
                  >
                    <button
                      aria-current={active ? "step" : undefined}
                      aria-describedby="scoring-flow-explanation"
                      className="scoring-flow-step-button"
                      data-active={active || undefined}
                      data-pending={pending || undefined}
                      onFocus={() => setHoveredStep(number)}
                      onBlur={() => setHoveredStep(null)}
                      onClick={() => setHoveredStep(number)}
                      type="button"
                    >
                      <strong>{number}</strong>
                      {item.title}
                      {number === 3 && <small>4 tiêu chí · Task 1 / 2</small>}
                      {number === 2 && (
                        <small className="scoring-overview-mono">
                          X-API-Key · X-User-Identity · Idempotency-Key
                        </small>
                      )}
                    </button>
                    {item.direction !== "none" && (
                      <span
                        aria-hidden="true"
                        className={`scoring-flow-arrow scoring-flow-arrow--${item.direction}`}
                      />
                    )}
                  </div>
                );
              })}
              <div
                className={`scoring-flow-result${flowStep >= 5 && hoveredStep === null ? " is-active" : flowStep > 0 && flowStep < 5 && hoveredStep === null ? " is-pending" : ""}`}
              >
                Hiển thị band + highlight lỗi
              </div>
            </div>
            <p
              className="scoring-flow-explanation"
              id="scoring-flow-explanation"
              aria-live="polite"
            >
              <span className="scoring-overview-badge">{explanation.tag}</span>
              <span>{explanation.text}</span>
            </p>
          </div>
        </div>
      </section>
      <section
        className="scoring-after-overview"
        aria-labelledby="scoring-demo-title"
      >
        <p className="demo-flow-eyebrow">SAU ĐÓ</p>
        <h2 id="scoring-demo-title">Thử chấm Writing Task 1 hoặc Task 2</h2>
      </section>
    </div>
  );
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
  const upstreamRequestBody = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(requestBody).filter(([name]) => name !== "task")
      ),
    [requestBody]
  );
  /** Every copyable artifact describes the AIHUB call, so Mock offers it too. */
  const copyableExports = useMemo(
    () =>
      step !== 4
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
            body: upstreamRequestBody,
            idempotencyKey: idempotencyKey ?? undefined,
          }),
    [environment, idempotencyKey, step, task, upstreamRequestBody]
  );
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
    const submittedEnvironment =
      demoEnvironmentHintFromApiKey(submittedKey) ?? environment;
    if (submittedEnvironment !== environment)
      setEnvironment(submittedEnvironment);
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

  const scoringRequestPreview = {
    method: "POST",
    url: `${demoEnvironmentHost(environment)}/v1/ielts/writing/task${task}/grade`,
    headers: {
      "X-API-Key": "${AIHUB_API_KEY:?Set AIHUB_API_KEY to your API key first}",
      "X-User-Identity": "<your end-user id>",
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey ?? "<generate UUID before submit>",
    },
    body: upstreamRequestBody,
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
    return pretty(scoringRequestPreview);
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
    if (!liveReady)
      return gradeResponse
        ? pretty(gradeResponse)
        : pretty({
            message: "Chưa submit fixture mẫu.",
          });
    return gradeResponse
      ? pretty(gradeResponse)
      : pretty({
          message:
            gradeStatus === "submitting"
              ? "Request đang chạy; chưa nhận response."
              : "Chưa gửi request.",
        });
  };

  const consoleRequest = requestForStep();
  const consoleResponse = responseForStep();

  return (
    <DemoWorkbench
      skill="scoring"
      scope={SCOPE}
      title="Chấm điểm IELTS Writing"
      description={`Thử Writing Task 1 và Task 2 theo đúng API contract. Bỏ qua key để xem fixture read-only; key ${demoEnvironmentName(environment)} hợp lệ mở chỉnh sửa và chấm thật.`}
      step={step}
      steps={SCORING_STEPS}
      showTrace={step === 4}
      showEnvironmentPicker={demoEnvironmentRequiresSelection(apiKey.trim())}
      stepperDisabled={grading || gradeStatus === "submitting"}
      mode={mode}
      status={
        gradeStatus === "submitting"
          ? `Đang chấm · ${elapsed}s`
          : activeResult
            ? activeResult.mode === "mock"
              ? "KẾT QUẢ MẪU"
              : gradeTrace
                ? `HTTP ${gradeTrace.status}`
                : "LIVE RESPONSE"
            : (gradeError?.code ?? (keyError ? "KEY INVALID" : "READY"))
      }
      request={consoleRequest}
      response={consoleResponse}
      overview={<ScoringFlowOverview />}
      environment={environment}
      onEnvironmentChange={(value) => {
        setEnvironment(value);
        setIdempotencyKey(globalThis.crypto.randomUUID());
      }}
      productionAcknowledged={state.productionAcknowledged}
      requiresProductionAcknowledgement={requiresProductionAcknowledgement()}
      onAcknowledgeProduction={acknowledgeProduction}
      sandboxAllowance={allowance}
      productionKeyValidated={isScopeValidated(SCOPE) && Boolean(apiKey)}
      exports={copyableExports}
      traceNote={
        liveReady
          ? `Every live grading request reauthenticates the ${demoEnvironmentName(environment)} key before quota and AI dispatch; trace redacts the key.`
          : "Request is shown as a preview. The button returns a fixed frontend fixture; no grading API request is sent."
      }
    >
      <p className="demo-flow-eyebrow">
        BƯỚC {step} / {SCORING_STEPS.length} · {SCORING_STEPS[step - 1]}
      </p>

      {step === 1 && (
        <>
          <h3>Kiểm tra API key</h3>
          <div className="demo-field">
            <label htmlFor="writing-demo-key">
              API key (Sandbox hoặc Production, tùy chọn)
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
              placeholder="aihub_sandbox_… hoặc aihub_prod_…"
              spellCheck={false}
              type="password"
              value={apiKey}
            />
            <p className="demo-help">
              Backend kiểm tra môi trường và quyền chấm Writing trước khi mở
              tính năng chấm thật.
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
            {liveReady
              ? `Key ${demoEnvironmentName(environment)} đã xác thực. Bạn có thể sửa đề và các trường request ở bước này; dữ liệu đã nhập sẽ được dùng khi chấm.`
              : "Mẫu chỉ đọc: chọn Task và đề mẫu để xem fixture. Các trường request và bài làm bị khóa; nhập key hợp lệ ở bước 1 để mở chỉnh sửa và chấm live."}
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
                  {liveReady
                    ? "Chọn đúng một trong bảy giá trị enum, phân biệt hoa thường; giá trị này sẽ được gửi trong request."
                    : "Mẫu chỉ đọc. Nhập key hợp lệ để chỉnh trường này."}
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
                  {liveReady
                    ? "AIHUB cần truy cập ảnh qua HTTPS. Dùng URL ảnh thật khi chấm live."
                    : "Mẫu chỉ đọc. Nhập key hợp lệ để sửa image_url trước khi chấm live."}
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
                {liveReady
                  ? "Topic là text tự do theo contract, tối đa 200 ký tự; giá trị này sẽ được gửi trong request."
                  : "Mẫu chỉ đọc. Nhập key hợp lệ để chỉnh topic (tối đa 200 ký tự)."}
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
                ? "Question là text tự do theo API contract; nội dung sẽ được gửi theo đúng phần bạn nhập."
                : "Chọn đề mẫu để xem nội dung. Bài làm và kết quả mẫu không đổi theo lựa chọn; request và bài làm chỉ mở khi key hợp lệ."}
            </p>
          </div>
          <div className="demo-step-actions">
            <button
              className="demo-btn-secondary"
              onClick={() => setStep(1)}
              type="button"
            >
              Quay lại API key
            </button>
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
              ? `Key đã xác thực: bạn có thể sửa bài bên dưới. Nội dung chỉ được gửi lên ${demoEnvironmentName(environment)} khi bấm chấm ở bước 4.`
              : "Mẫu chỉ đọc: bài viết tham khảo và kết quả mẫu luôn cố định. Nhập key hợp lệ ở bước 1 để mở trình soạn thảo và chấm live."}
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
              : "Nút này chỉ hiển thị kết quả mẫu có sẵn. Không gửi yêu cầu chấm bài."}
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
    </DemoWorkbench>
  );
}
