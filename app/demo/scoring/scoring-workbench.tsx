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
import { isEndUserId } from "@/lib/end-user-id";
import { useDemoSession, type DemoScope } from "@/app/demo/demo-session";
import { sandboxAllowanceFrom } from "@/app/demo/demo-session-state";
import {
  DEMO_STEPS,
  DemoWorkbench,
  DemoUserIdentityField,
  type DemoStep,
} from "@/app/demo/demo-workbench";
import {
  CLIENT_BUDGET_SECONDS,
  errorFromPayload,
  SAMPLE_DRAFT,
} from "./scoring-client.js";
import type { Draft, PublicError } from "./scoring-client.js";
import { ChartImageUpload } from "./chart-image-upload.js";
import { criterionLabel, GradeReport } from "./scoring-report.js";

const SCOPE: DemoScope = "writing.grade";
const TASKS = [1, 2] as const;
const CHART_TYPE_LABELS: Record<
  (typeof WRITING_TASK1_CHART_TYPES)[number],
  string
> = {
  "Bar Chart": "Biểu đồ cột",
  "Line Graph": "Biểu đồ đường",
  "Pie Chart": "Biểu đồ tròn",
  Table: "Bảng số liệu",
  Map: "Bản đồ",
  "Process Diagram": "Sơ đồ quy trình",
  "Multiple Graphs": "Nhiều biểu đồ",
};
const SCORING_STEPS = [
  "Chuẩn bị mã API và mã người dùng",
  ...DEMO_STEPS.slice(1, 4),
];

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
    : "Chưa nhận được thông tin phản hồi.";
}

const SCORING_FLOW_STAGES = [
  {
    title: "Học viên bấm Nộp bài; ứng dụng gửi đề và bài làm",
    detail:
      "Ứng dụng gửi đề và bài làm đến hệ thống của bạn. Task 1 có loại biểu đồ và ảnh; Task 2 có chủ đề. Mã API được giữ an toàn tại đó.",
    direction: "right",
  },
  {
    title: "Hệ thống của bạn gửi bài lên AIHUB để chấm",
    detail:
      "Hệ thống của bạn bổ sung thông tin cần thiết rồi chuyển bài đến AIHUB. Mỗi bài được xử lý riêng để tránh gửi trùng.",
    direction: "right",
  },
  {
    title: "Chấm theo 4 tiêu chí",
    detail:
      "Task 1 được chấm mức độ hoàn thành đề; Task 2 được chấm mức độ trả lời đúng yêu cầu. Cả hai cùng được chấm về mạch lạc, từ vựng và ngữ pháp.",
    direction: "none",
  },
  {
    title: "Gửi điểm và nhận xét",
    detail:
      "Kết quả gồm điểm tổng thể, điểm từng tiêu chí và những câu cần góp ý trong bài.",
    direction: "left",
  },
  {
    title: "Hệ thống của bạn gửi kết quả lại ứng dụng",
    detail:
      "Ứng dụng hiển thị điểm và gắn nhận xét vào đúng câu trong bài viết.",
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
          text: "Đó là toàn bộ các bước. Kéo xuống phần thực hành Writing để thử Task 1 hoặc Task 2 và xem kết quả.",
        }
      : {
          tag: "Gợi ý",
          text: "Phần minh họa này không gửi bài đi chấm. Bấm “Nộp bài” để xem các bước, hoặc chọn từng chặng để đọc giải thích.",
        };
  const running = flowStep > 0 && flowStep <= SCORING_FLOW_STAGES.length;

  return (
    <div className="scoring-overview">
      <section aria-labelledby="scoring-overview-title">
        <div className="scoring-overview-heading">
          <span className="scoring-overview-badge">TRƯỚC TIÊN</span>
          <h2 id="scoring-overview-title">
            Các bước chấm IELTS Writing (Task 1 &amp; Task 2)
          </h2>
          <span>Tổng quan trước khi thực hành</span>
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
                    [Ảnh biểu đồ mẫu]
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
                    [Chủ đề]
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
                <span>Chọn để xem các bước</span>
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
                <strong>Ứng dụng của bạn</strong>
                <span>học viên nộp bài</span>
              </div>
              <div>
                <strong>Hệ thống của bạn</strong>
                <span>giữ mã API</span>
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
                        <small>Mã truy cập và thông tin cần thiết</small>
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
                Hiển thị điểm và nhận xét trong bài
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
    userIdentity,
    setUserIdentity,
    ensureUserIdentity,
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
  const [, setGradeAttempted] = useState(false);
  const [chartUploadBusy, setChartUploadBusy] = useState(false);
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
  const userIdentityValid = isEndUserId(userIdentity);
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
            apiKey: liveReady ? apiKey.trim() : undefined,
            path: `/v1/ielts/writing/task${task}/grade`,
            headers: [
              {
                name: "X-User-Identity",
                value: userIdentityValid ? userIdentity : "<your end-user id>",
              },
              { name: "Content-Type", value: "application/json" },
            ],
            body: upstreamRequestBody,
            idempotencyKey: idempotencyKey ?? undefined,
          }),
    [
      apiKey,
      environment,
      idempotencyKey,
      liveReady,
      step,
      task,
      upstreamRequestBody,
      userIdentity,
      userIdentityValid,
    ]
  );
  const activeResult = result?.task === task ? result : null;
  /** Informational only: every grade re-checks the allowance upstream. */
  const allowance = isScopeValidated(SCOPE)
    ? sandboxAllowanceFrom(keyCheckResponse)
    : undefined;
  const chartProblem =
    task === 1 && !isFetchableImageUrl(activeDraft.imageUrl ?? "")
      ? "Đường dẫn ảnh cần bắt đầu bằng https:// và mở được trên internet."
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
        message: "Dán mã API hoặc chọn xem bài mẫu.",
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
          message:
            "Không đọc được kết quả kiểm tra mã API. Thử lại hoặc xem bài mẫu.",
        } satisfies PublicError;
      }
      markScopeValidated(SCOPE);
      setIdempotencyKey(globalThis.crypto.randomUUID());
      ensureUserIdentity();
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
              message: "Không kiểm tra được mã API. Thử lại hoặc xem bài mẫu.",
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
      message: "Đã bỏ qua kiểm tra mã API; đang dùng bài mẫu có sẵn.",
    });
    setIdempotencyKey(globalThis.crypto.randomUUID());
    ensureUserIdentity();
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
    if (!userIdentityValid) {
      setGradeError({
        code: "INVALID_USER_IDENTITY",
        message: "Nhập mã người dùng gồm 1–256 ký tự, không chứa khoảng trắng.",
      });
      return;
    }
    // The first Production grade of a visit needs the billable acknowledgement;
    // it is not a spend cap, only a gate the backend still enforces afterwards.
    if (requiresProductionAcknowledgement()) {
      setGradeError({
        code: "PRODUCTION_ACKNOWLEDGEMENT_REQUIRED",
        message:
          "Hãy xác nhận trong phần “Nơi chấm bài” rằng môi trường thật có thể phát sinh chi phí.",
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
          "X-Demo-User-Identity": userIdentity,
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
      "X-API-Key": liveReady ? apiKey.trim() : "[chưa có mã API hợp lệ]",
      "X-User-Identity": userIdentityValid
        ? userIdentity
        : "<your end-user id>",
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
              source: "đã chọn xem bài mẫu",
              http_request: null,
              message: "Đã bỏ qua bước kiểm tra mã API.",
            }
          : {
              source: keyCheckResponse
                ? "đã gửi yêu cầu kiểm tra mã"
                : apiKey.trim()
                  ? "chưa gửi yêu cầu kiểm tra mã"
                  : "chưa nhập mã API",
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
        source: "bài mẫu có sẵn",
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
        source: liveReady ? "bản xem trước · chưa gửi" : "bài mẫu · chưa gửi",
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
                "X-Demo-User-Identity": userIdentityValid
                  ? userIdentity
                  : "<your end-user id>",
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
            source: "đã chọn xem bài mẫu",
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
              message: "Chưa kiểm tra mã API.",
            });
    if (step === 2)
      return pretty({
        source: "bài mẫu có sẵn",
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
        source: "bản xem trước bài làm",
        http_response: null,
        message: "Chưa gửi bài. Nội dung xem trước nằm ở mục Thông tin gửi đi.",
      });
    if (!liveReady)
      return gradeResponse
        ? pretty(gradeResponse)
        : pretty({
            message: "Chưa xem kết quả mẫu.",
          });
    return gradeResponse
      ? pretty(gradeResponse)
      : pretty({
          message:
            gradeStatus === "submitting"
              ? "Đang chấm bài; chưa có kết quả."
              : "Chưa gửi bài đi chấm.",
        });
  };

  const consoleRequest = requestForStep();
  const consoleResponse = responseForStep();

  return (
    <DemoWorkbench
      skill="scoring"
      title="Chấm điểm IELTS Writing"
      description="Thử chấm IELTS Writing Task 1 hoặc Task 2. Bạn có thể xem bài mẫu trước; nhập mã API để sửa nội dung và gửi bài chấm thật."
      step={step}
      steps={SCORING_STEPS}
      showTrace={step === 4}
      showEnvironmentPicker={demoEnvironmentRequiresSelection(apiKey.trim())}
      stepperDisabled={
        grading || gradeStatus === "submitting" || chartUploadBusy
      }
      mode={mode}
      status={
        gradeStatus === "submitting"
          ? `Đang chấm · ${elapsed}s`
          : activeResult
            ? activeResult.mode === "mock"
              ? "Kết quả mẫu có sẵn"
              : gradeTrace
                ? `HTTP ${gradeTrace.status}`
                : "Đã chấm thật"
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
          ? "Mã API xuất hiện trong thông tin gửi đi và lệnh được sao chép. Hãy giữ kín ảnh chụp và nội dung đã sao chép."
          : "Nút này chỉ hiển thị điểm và nhận xét mẫu có sẵn; bài của bạn không được gửi đi chấm."
      }
      exportsContainApiKey={liveReady}
    >
      <p className="demo-flow-eyebrow">
        BƯỚC {step} / {SCORING_STEPS.length} · {SCORING_STEPS[step - 1]}
      </p>

      {step === 1 && (
        <>
          <h3>Nhập mã API</h3>
          <div className="demo-field">
            <label htmlFor="writing-demo-key">Mã API (không bắt buộc)</label>
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
              placeholder="Dán mã API của bạn tại đây"
              spellCheck={false}
              type="password"
              value={apiKey}
            />
            <p className="demo-help">
              Nhập mã API để sửa bài và gửi chấm thật. Bạn có thể bỏ qua bước
              này để xem bài mẫu; mã dùng thử miễn phí, môi trường thật có thể
              tính phí.
            </p>
          </div>
          <DemoUserIdentityField
            disabled={grading}
            id="writing-demo-user-identity"
            onChange={(value) => {
              setUserIdentity(value);
              setIdempotencyKey(globalThis.crypto.randomUUID());
              setGradeError(null);
              setGradeResponse(null);
              setGradeTrace(null);
              setGradeAttempted(false);
              setResult(null);
            }}
            value={userIdentity}
          />
          {keyError && (
            <div className="demo-error" role="alert">
              {keyError.message}
            </div>
          )}
          {isScopeValidated(SCOPE) && apiKey && (
            <div className="demo-success">
              Mã API đã được xác nhận. Mã sẽ được kiểm tra lại mỗi lần bạn gửi
              bài.
            </div>
          )}
          <div className="demo-step-actions">
            <button
              className="demo-btn-primary"
              disabled={grading || checkingKey || !apiKey.trim()}
              onClick={validateKey}
              type="button"
            >
              {checkingKey ? "Đang kiểm tra · " : null}Kiểm tra mã API
            </button>
            <button
              className="demo-btn-secondary"
              disabled={grading || checkingKey}
              onClick={useMock}
              type="button"
            >
              Xem bài mẫu
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h3>Chọn bài Writing</h3>
          <p>
            {liveReady
              ? "Mã API đã được xác nhận. Bạn có thể sửa đề và thông tin bài; nội dung mới sẽ được dùng khi chấm."
              : "Bạn đang xem bài mẫu. Chọn Task và đề để xem trước; nhập mã API ở bước 1 nếu muốn tự sửa và gửi chấm thật."}
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
                <label htmlFor="writing-chart-type">Loại biểu đồ</label>
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
                    <option key={value} value={value}>
                      {CHART_TYPE_LABELS[value]}
                    </option>
                  ))}
                </select>
                <p className="demo-help">
                  {liveReady
                    ? "Chọn loại biểu đồ phù hợp với đề bài."
                    : "Đây là thông tin trong bài mẫu. Nhập mã API ở bước 1 để sửa."}
                </p>
              </div>
              <div className="demo-field">
                <label htmlFor="writing-image-url">Đường dẫn ảnh</label>
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
                    ? "Dán liên kết ảnh có thể mở được trên internet."
                    : "Bài mẫu đang dùng ảnh có sẵn. Nhập mã API ở bước 1 để thay ảnh."}
                </p>
              </div>
              {liveReady && (
                <ChartImageUpload
                  apiKey={apiKey}
                  environment={environment}
                  identity={userIdentity}
                  identityValid={userIdentityValid}
                  grading={grading}
                  onBusyChange={setChartUploadBusy}
                  onUploaded={(imageUrl) => setDraft({ imageUrl })}
                />
              )}
            </>
          )}
          {task === 2 && (
            <div className="demo-field">
              <label htmlFor="writing-topic">Chủ đề</label>
              <input
                data-testid="input-topic"
                disabled={!liveReady}
                id="writing-topic"
                onChange={(event) => setDraft({ topic: event.target.value })}
                value={activeDraft.topic}
              />
              <p className="demo-help">
                {liveReady
                  ? "Nhập chủ đề ngắn, tối đa 200 ký tự."
                  : "Đây là chủ đề trong bài mẫu. Nhập mã API ở bước 1 để sửa."}
              </p>
            </div>
          )}
          <div className="demo-field">
            <label htmlFor={liveReady ? "writing-question" : undefined}>
              {liveReady ? "Đề bài" : "Chọn một đề mẫu"}
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
                ? "Bạn có thể sửa đề bài. Nội dung này sẽ được dùng khi chấm."
                : "Chọn đề để xem nội dung. Bài làm và điểm mẫu vẫn giữ nguyên; nhập mã API ở bước 1 để tự sửa bài."}
            </p>
          </div>
          <div className="demo-step-actions">
            <button
              className="demo-btn-secondary"
              onClick={() => setStep(1)}
              type="button"
            >
              Quay lại nhập mã API
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
              ? "Mã API đã được xác nhận: bạn có thể sửa bài bên dưới. Nội dung chỉ được gửi đi chấm khi bấm nút ở bước 4."
              : "Đây là bài viết tham khảo và điểm mẫu có sẵn. Nhập mã API ở bước 1 để sửa bài và gửi chấm thật."}
          </p>
          <div className="demo-field">
            <label htmlFor="writing-essay">
              Bài làm ·{" "}
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
          <h3>{liveReady ? "Gửi bài chấm thật" : "Xem kết quả mẫu"}</h3>
          <p>
            {liveReady
              ? "Bài làm sẽ được gửi bằng mã API đã xác nhận. Mỗi lần gửi, mã được kiểm tra lại."
              : "Nút này chỉ hiển thị điểm và nhận xét mẫu có sẵn. Bài của bạn không được gửi đi chấm."}
          </p>
          {gradeError && (
            <div className="demo-error" role="alert">
              {gradeError.message}
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
                chartUploadBusy ||
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
                  ? "KẾT QUẢ MẪU"
                  : "KẾT QUẢ CHẤM THẬT"}
              </p>
              <div className="demo-result-band">
                Điểm tổng thể{" "}
                {activeResult.envelope.data.overall_band.toFixed(1)}
              </div>
              <p>{activeResult.envelope.data.summary}</p>
              <div className="demo-result-criteria">
                {activeResult.envelope.data.criteria.map((criterion) => (
                  <div key={criterion.id}>
                    <strong>
                      {criterionLabel(criterion.id, "Tiêu chí chấm")}
                    </strong>
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
              mode={activeResult.mode}
            />
          )}
        </>
      )}
    </DemoWorkbench>
  );
}
