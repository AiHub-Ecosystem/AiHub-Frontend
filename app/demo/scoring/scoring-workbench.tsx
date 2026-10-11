"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  FileText,
  Info,
  KeyRound,
  Lightbulb,
  Send,
  Timer,
} from "lucide-react";

import { isWritingGradingEnvelope } from "@/data/scoring-response";
import type { WritingGradingEnvelope } from "@/data/scoring-response";
import {
  WRITING_TASK1_CHART_TYPES,
  WRITING_TASK1_IMAGE_NOTE,
  WRITING_TASK1_REQUEST,
} from "@/data/writing-task1-request";

/** The client budget. The real 90s, not a simulated delay. */
const CLIENT_BUDGET_SECONDS = 90;

type PublicError = {
  code: string;
  message: string;
  retryable?: boolean;
  retry_after_ms?: number;
};

/**
 * Which colour scale a criterion wears. The four rubric slots map onto the
 * shared criterion tokens; Task Achievement and Task Response are the same slot
 * and deliberately share one colour.
 */
const CRITERION_TONE: Record<string, string> = {
  task_achievement: "achieve",
  task_response: "achieve",
  coherence_cohesion: "coherence",
  lexical_resource: "lexical",
  grammatical_range_accuracy: "grammar",
};

const CRITERION_ABBR: Record<string, string> = {
  task_achievement: "TA",
  task_response: "TR",
  coherence_cohesion: "CC",
  lexical_resource: "LR",
  grammatical_range_accuracy: "GRA",
};

function toneFor(criterionId: string) {
  return CRITERION_TONE[criterionId] ?? "achieve";
}

/**
 * `issue` is a free string the downstream varies per run, not an enum from any
 * fixed list in this repository. It is rendered as the string it is.
 */
function errorFromPayload(payload: unknown): PublicError {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "code" in payload.error &&
    "message" in payload.error &&
    typeof payload.error.code === "string" &&
    typeof payload.error.message === "string"
  ) {
    const error = payload.error as {
      retryable?: unknown;
      retry_after_ms?: unknown;
    };
    return {
      code: payload.error.code,
      message: payload.error.message,
      ...(typeof error.retryable === "boolean"
        ? { retryable: error.retryable }
        : {}),
      ...(typeof error.retry_after_ms === "number"
        ? { retry_after_ms: error.retry_after_ms }
        : {}),
    };
  }
  return {
    code: "AI_SERVICE_UNAVAILABLE",
    message: "Không đọc được kết quả. Thử lại sau nhé.",
  };
}

function newIdempotencyKey() {
  return crypto.randomUUID();
}

/** The overview teaches the header contract the demo itself cannot show. */
const INTEGRATION_STEPS = [
  {
    step: "1",
    title: "Ứng dụng của bạn",
    body: "Nhận bài làm của người học từ form hoặc tệp của bạn.",
    icon: FileText,
  },
  {
    step: "2",
    title: "Server của bạn",
    body: "Giữ API key và User Identity. Không gọi thẳng từ trình duyệt.",
    icon: KeyRound,
  },
  {
    step: "3",
    title: "POST /v1/ielts/writing/task1/grade",
    body: "Gửi question, essay, chart_type và image_url kèm Idempotency-Key.",
    icon: Send,
  },
  {
    step: "4",
    title: "AIHUB chấm bài",
    body: "Dịch vụ chấm tải biểu đồ, chấm theo 4 tiêu chí IELTS.",
    icon: BarChart3,
  },
  {
    step: "5",
    title: "Báo cáo về hệ thống",
    body: "Nhận overall_band, criteria, annotations, suggestions và next_steps.",
    icon: Check,
  },
];

function Overview() {
  return (
    <section className="scoring-overview" aria-label="Các bước tích hợp">
      <div className="scoring-overview-copy">
        <p className="eyebrow">Tổng quan tích hợp</p>
        <h1>
          Chấm điểm bài viết IELTS theo 4 tiêu chí, gọi thẳng API của AIHUB
        </h1>
        <p className="scoring-endpoint">
          <span className="method">POST</span>
          <code>/v1/ielts/writing/task1/grade</code>
        </p>
        <p className="scoring-overview-lede">
          Bài làm được chấm bởi dịch vụ thật. Điểm về theo đúng bốn tiêu chí
          Task Achievement, Coherence &amp; Cohesion, Lexical Resource và
          Grammatical Range &amp; Accuracy, kèm trích dẫn nguyên văn những chỗ
          cần sửa.
        </p>
      </div>
      <ol className="scoring-flow">
        {INTEGRATION_STEPS.map((item) => {
          const Icon = item.icon;
          return (
            <li className="scoring-flow-step" key={item.step}>
              <span className="scoring-flow-num">{item.step}</span>
              <span className="scoring-flow-text">
                <strong>
                  <Icon size={12} /> {item.title}
                </strong>
                <span>{item.body}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function CriterionBadge({ criterionId }: { criterionId: string }) {
  return (
    <span className={`criterion-badge tone-${toneFor(criterionId)}`}>
      {CRITERION_ABBR[criterionId] ?? "—"}
    </span>
  );
}

function GradeReport({
  result,
  essay,
}: {
  result: WritingGradingEnvelope;
  essay: string;
}) {
  const { data } = result;
  const [selected, setSelected] = useState<number | null>(null);

  /**
   * Each annotation's quote becomes a chip in the essay. Quotes are located by
   * their index in the submitted text; a quote the essay does not contain is
   * still listed, it just has no inline anchor.
   */
  const anchored = useMemo(
    () =>
      data.annotations
        .map((annotation, order) => ({
          annotation,
          order,
          index: essay.indexOf(annotation.quote),
        }))
        .filter((item) => item.index >= 0)
        .sort((a, b) => a.index - b.index),
    [data.annotations, essay]
  );

  const segments = useMemo(() => {
    const parts: Array<
      | { kind: "text"; value: string }
      | { kind: "quote"; order: number; value: string }
    > = [];
    let cursor = 0;
    for (const item of anchored) {
      if (item.index < cursor) continue;
      if (item.index > cursor) {
        parts.push({ kind: "text", value: essay.slice(cursor, item.index) });
      }
      parts.push({
        kind: "quote",
        order: item.order,
        value: item.annotation.quote,
      });
      cursor = item.index + item.annotation.quote.length;
    }
    if (cursor < essay.length) {
      parts.push({ kind: "text", value: essay.slice(cursor) });
    }
    return parts;
  }, [anchored, essay]);

  return (
    <div className="feedback-dashboard" data-testid="scoring-report">
      <div className="feedback-header">
        <div>
          <h3>Báo cáo chấm bài Task 1</h3>
          <p>
            AIHUB Writing rubric · ngôn ngữ {data.language} · request{" "}
            {result.meta.request_id}
          </p>
        </div>
        <span className="score-badge">Overall Band: {data.overall_band}</span>
      </div>

      <div className="feedback-grid">
        {data.criteria.map((criterion) => (
          <div
            className={`score-card criterion-card tone-${toneFor(criterion.id)}`}
            key={criterion.id}
          >
            <div className="score-label">
              <span>{criterion.name}</span>
              <CriterionBadge criterionId={criterion.id} />
            </div>
            <div className="score-value">
              {criterion.band} <em>/ 9.0</em>
            </div>
          </div>
        ))}
      </div>

      <div className="transcript-section">
        <div className="section-kicker">
          BÀI LÀM &amp; NHẬN XÉT TỪNG CHỖ
          <span>{data.annotations.length} chỗ được trích</span>
        </div>
        <div className="scoring-essay" data-testid="scoring-essay">
          {segments.map((segment, index) =>
            segment.kind === "text" ? (
              <span key={"t" + index}>{segment.value}</span>
            ) : (
              <button
                aria-pressed={selected === segment.order}
                className={`word-chip criterion-chip tone-${toneFor(
                  data.annotations[segment.order].criterion
                )}`}
                data-testid={`annotation-chip-${segment.order}`}
                key={"q" + index}
                onClick={() =>
                  setSelected(selected === segment.order ? null : segment.order)
                }
                type="button"
              >
                {segment.value}
              </button>
            )
          )}
        </div>

        {selected !== null && data.annotations[selected] && (
          <div
            className={`scoring-annotation tone-${toneFor(
              data.annotations[selected].criterion
            )}`}
            data-testid="scoring-annotation-detail"
          >
            <div className="scoring-annotation-head">
              <CriterionBadge
                criterionId={data.annotations[selected].criterion}
              />
              <code className="scoring-annotation-issue">
                {data.annotations[selected].issue}
              </code>
            </div>
            <blockquote>{data.annotations[selected].quote}</blockquote>
            <p>{data.annotations[selected].explanation}</p>
          </div>
        )}
      </div>

      <div className="rubric-grid scoring-criteria">
        {data.criteria.map((criterion) => (
          <div
            className={`rubric-card criterion-card tone-${toneFor(criterion.id)}`}
            key={criterion.id}
          >
            <div className="section-kicker">
              <CriterionBadge criterionId={criterion.id} />
              {criterion.name} · Band {criterion.band}
            </div>
            <p>{criterion.band_reason}</p>
            <div className="scoring-criterion-lists">
              <div>
                <span className="section-kicker">Điểm mạnh</span>
                <ul>
                  {criterion.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="section-kicker">Cần cải thiện</span>
                <ul>
                  {criterion.improvements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rubric-grid">
        <div className="rubric-card">
          <div className="section-kicker">
            <Lightbulb size={11} /> Gợi ý
          </div>
          <ul className="scoring-plain-list">
            {data.suggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rubric-card">
          <div className="section-kicker">
            <CircleCheck size={11} /> Bước tiếp theo
          </div>
          <ul className="scoring-plain-list">
            {data.next_steps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function ScoringWorkbench() {
  const [question, setQuestion] = useState(WRITING_TASK1_REQUEST.question);
  const [essay, setEssay] = useState(WRITING_TASK1_REQUEST.essay);
  const [chartType, setChartType] = useState<string>(
    WRITING_TASK1_REQUEST.chart_type
  );
  const [imageUrl, setImageUrl] = useState(WRITING_TASK1_REQUEST.image_url);
  // The key is random, so it cannot be produced during SSR without a hydration
  // mismatch: the server and the client would each render a different UUID.
  // `crypto` is the external system here, which is what an effect is for, so
  // the key is minted after mount and rendered as a placeholder until then.
  // Nothing about a grade is persisted — every load starts fresh.
  const [idempotencyKey, setIdempotencyKey] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs a browser-only random value; see above
  useEffect(() => setIdempotencyKey(newIdempotencyKey()), []);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">(
    "idle"
  );
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<WritingGradingEnvelope | null>(null);
  const [error, setError] = useState<PublicError | null>(null);
  const [copied, setCopied] = useState(false);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (status !== "submitting") return;
    const timer = window.setInterval(
      () => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [status]);

  const submit = async () => {
    if (status === "submitting") return;
    setStatus("submitting");
    setError(null);
    setResult(null);
    setElapsed(0);
    startedAtRef.current = Date.now();

    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      CLIENT_BUDGET_SECONDS * 1000
    );
    try {
      const response = await fetch("/api/demo/scoring/grade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          task: 1,
          question,
          essay,
          chart_type: chartType,
          image_url: imageUrl,
        }),
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw errorFromPayload(payload);
      if (!isWritingGradingEnvelope(payload)) {
        throw {
          code: "AI_SERVICE_CONTRACT_VIOLATION",
          message: "Kết quả từ AIHUB không đúng định dạng.",
        } satisfies PublicError;
      }
      setResult(payload);
      setStatus("success");
      // A fresh key per submission: the button grades twice rather than
      // replaying a stored result.
      setIdempotencyKey(newIdempotencyKey());
    } catch (caught) {
      const nextError =
        typeof caught === "object" &&
        caught !== null &&
        "code" in caught &&
        "message" in caught &&
        typeof caught.code === "string" &&
        typeof caught.message === "string"
          ? (caught as PublicError)
          : {
              code: "AI_SERVICE_TIMEOUT",
              message: `Yêu cầu mất quá ${CLIENT_BUDGET_SECONDS} giây. Bấm lại nút chấm để thử lại bằng một lần chấm mới.`,
            };
      setError(nextError);
      setStatus("idle");
      setIdempotencyKey(newIdempotencyKey());
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const requestPreview = useMemo(
    () =>
      JSON.stringify(
        {
          task: 1,
          question,
          essay,
          chart_type: chartType,
          image_url: imageUrl,
        },
        null,
        2
      ),
    [question, essay, chartType, imageUrl]
  );

  return (
    <main className="aihub-demo aihub-scoring scoring-page">
      <div className="app-shell">
        <div className="app-container">
          <Overview />

          <div className="lab-layout">
            <aside className="card setup-card">
              <div className="setup-intro">
                <div className="eyebrow">Bài làm mẫu</div>
                <h2>Task 1 · Mô tả biểu đồ</h2>
                <p>
                  Biểu đồ, đề bài và bài làm đã điền sẵn từ ví dụ công bố của
                  AIHUB, nên bấm nút là chấm được ngay.
                </p>
              </div>

              <div className="scoring-form">
                <label className="mini-label" htmlFor="chart-type">
                  Loại biểu đồ
                </label>
                <select
                  className="scoring-select"
                  data-testid="select-chart-type"
                  id="chart-type"
                  onChange={(event) => setChartType(event.target.value)}
                  value={chartType}
                >
                  {WRITING_TASK1_CHART_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <p className="scoring-help">
                  Phân biệt hoa thường. Endpoint nhận đúng 7 giá trị này và
                  &quot;bar chart&quot; sẽ bị từ chối với 400.
                </p>

                <label className="mini-label" htmlFor="image-url">
                  Đường dẫn ảnh biểu đồ
                </label>
                <input
                  className="question-combobox-input scoring-input"
                  data-testid="input-image-url"
                  id="image-url"
                  onChange={(event) => setImageUrl(event.target.value)}
                  type="url"
                  value={imageUrl}
                />
                <p className="scoring-help">{WRITING_TASK1_IMAGE_NOTE}</p>
                {imageUrl.trim() ? (
                  <figure className="scoring-chart-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="Xem trước biểu đồ sẽ chấm" src={imageUrl} />
                    <figcaption>Ảnh sẽ được dịch vụ chấm tải.</figcaption>
                  </figure>
                ) : null}

                <label className="mini-label" htmlFor="question">
                  Đề bài
                </label>
                <textarea
                  className="scoring-textarea"
                  data-testid="input-question"
                  id="question"
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={4}
                  value={question}
                />

                <label className="mini-label" htmlFor="essay">
                  Bài làm
                </label>
                <textarea
                  className="scoring-textarea scoring-essay-input"
                  data-testid="input-essay"
                  id="essay"
                  onChange={(event) => setEssay(event.target.value)}
                  rows={12}
                  value={essay}
                />
              </div>

              <div className="scoring-submit">
                <label className="mini-label" htmlFor="idempotency-key">
                  Idempotency-Key cho lần gửi tới
                </label>
                <output
                  className="scoring-idempotency"
                  data-testid="output-idempotency-key"
                  id="idempotency-key"
                >
                  {idempotencyKey || "—"}
                </output>
                <p className="scoring-help">
                  Header bắt buộc. Không có nút tạo key mới: bấm nút chấm hai
                  lần là hai lần chấm có tính phí, không phải phát lại kết quả
                  đã lưu.
                </p>

                <button
                  className="btn btn-primary scoring-submit-btn"
                  data-testid="button-grade"
                  disabled={status === "submitting"}
                  onClick={submit}
                  type="button"
                >
                  {status === "submitting" ? (
                    <Timer size={12} />
                  ) : (
                    <Send size={12} />
                  )}{" "}
                  {status === "submitting"
                    ? `Đang chấm… ${elapsed}s`
                    : "Chấm bài Task 1"}
                </button>

                {status === "submitting" && (
                  <div
                    aria-live="polite"
                    className="scoring-progress"
                    data-testid="scoring-progress"
                    role="status"
                  >
                    <div className="progress-bar">
                      <i
                        style={{
                          width:
                            Math.min(
                              100,
                              (elapsed / CLIENT_BUDGET_SECONDS) * 100
                            ) + "%",
                        }}
                      />
                    </div>
                    <p className="scoring-help">
                      Ngân sách phía trình duyệt là {CLIENT_BUDGET_SECONDS}{" "}
                      giây. Demo không tự thử lại: một lần thử lại là một lần
                      chấm mới.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="inline-error" data-testid="scoring-error">
                    <strong>{error.code}</strong> {error.message}
                    {error.retry_after_ms !== undefined && (
                      <span>
                        {error.retryable === false
                          ? "Không tự thử lại được"
                          : "Có thể thử lại sau"}{" "}
                        {Math.round(error.retry_after_ms / 60_000)} phút.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </aside>

            <section className="card main-card scoring-result">
              <div className="main-heading">
                <div>
                  <h2>
                    AIHub Demo — Chấm điểm Writing{" "}
                    <span className="stable-badge">STABLE</span>
                  </h2>
                  <p>
                    Trả về band tổng, bốn tiêu chí, và các câu bị trích ra kèm
                    giải thích.
                  </p>
                </div>
                <span className="main-status">
                  {result ? "live response" : "AIHUB gateway"}
                </span>
              </div>

              <div className="console">
                {result ? (
                  <GradeReport result={result} essay={essay} />
                ) : (
                  <div className="console-empty">
                    {
                      "// Chưa có kết quả — bấm “Chấm bài Task 1” để gửi bài làm mẫu lên sandbox AIHUB."
                    }
                  </div>
                )}
              </div>

              {result && (
                <div className="console-footer">
                  <span>
                    <CircleCheck size={10} /> evaluation complete
                  </span>
                  <button
                    className="console-copy"
                    onClick={() => {
                      void navigator.clipboard?.writeText(
                        JSON.stringify(result, null, 2)
                      );
                      setCopied(true);
                    }}
                    type="button"
                  >
                    <Copy size={11} /> {copied ? "Đã copy" : "Copy JSON"}
                  </button>
                </div>
              )}

              <div className="scoring-request-note">
                <Info size={12} />
                <span>
                  Request gửi đi: <code>POST /api/demo/scoring/grade</code> →
                  <code>/v1/ielts/writing/task1/grade</code>
                </span>
                <button
                  className="console-copy"
                  onClick={() => {
                    void navigator.clipboard?.writeText(requestPreview);
                    setCopied(true);
                  }}
                  type="button"
                >
                  <Copy size={11} /> Copy body
                </button>
              </div>
            </section>
          </div>

          <footer className="scoring-footer">
            <p>
              Cần tích hợp vào hệ thống của bạn? Đọc tài liệu endpoint và đăng
              ký API key tại{" "}
              <Link href="/product/scoring/api/grade-task1">
                tài liệu Chấm bài Task 1
              </Link>
              .
            </p>
            <div className="scoring-footer-actions">
              <Link className="btn btn-sm" href="/docs">
                Tài liệu API
              </Link>
              <Link className="btn btn-sm btn-primary" href="/console/orgs">
                <KeyRound size={12} /> Đăng ký API key
              </Link>
              <Link className="btn btn-sm" href="/demo">
                <CircleAlert size={12} /> Danh mục demo
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
