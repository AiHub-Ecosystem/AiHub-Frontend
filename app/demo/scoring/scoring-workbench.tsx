"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  Copy,
  Info,
  KeyRound,
  Send,
  Timer,
} from "lucide-react";

import { isWritingGradingEnvelope } from "@/data/scoring-response";
import type { WritingGradingEnvelope } from "@/data/scoring-response";
import {
  WRITING_TASK1_CHART_TYPES,
  WRITING_TASK1_IMAGE_NOTE,
} from "@/data/writing-task1-request";

import {
  CLIENT_BUDGET_SECONDS,
  errorFromPayload,
  newIdempotencyKey,
  SAMPLE_DRAFT,
} from "./scoring-client";
import type { Draft, PublicError } from "./scoring-client";
import { Overview } from "./scoring-overview";
import { GradeReport } from "./scoring-report";

export default function ScoringWorkbench() {
  // The active task lives in the URL, so it survives a reload, a bookmark and
  // a shared link. The page is force-dynamic, so this is available during the
  // server render and needs no Suspense boundary.
  const searchParams = useSearchParams();
  const task = searchParams.get("task") === "2" ? 2 : 1;

  const [drafts, setDrafts] = useState(SAMPLE_DRAFT);
  const draft = drafts[task];
  const setDraft = (patch: Partial<Draft>) =>
    setDrafts((previous) => ({
      ...previous,
      [task]: { ...previous[task], ...patch },
    }));
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
  // A report belongs to the task that produced it. Tab state survives a
  // switch, so without the task recorded here a Task 1 report would render
  // under the Task 2 heading.
  const [result, setResult] = useState<{
    task: 1 | 2;
    envelope: WritingGradingEnvelope;
  } | null>(null);
  const graded = result?.task === task ? result.envelope : null;
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

  const requestBody = useMemo(
    () =>
      // Exactly the fields the task's schema allows. Task 2 carries no chart
      // type or image URL, so neither is sent rather than sent and stripped.
      task === 2
        ? {
            task,
            question: draft.question,
            essay: draft.essay,
            topic: draft.topic,
          }
        : {
            task,
            question: draft.question,
            essay: draft.essay,
            chart_type: draft.chartType,
            image_url: draft.imageUrl,
          },
    [task, draft]
  );

  const requestPreview = useMemo(
    () => JSON.stringify(requestBody, null, 2),
    [requestBody]
  );

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
        body: JSON.stringify(requestBody),
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
      setResult({ task, envelope: payload });
      setStatus("success");
      // A fresh key per submission: the button grades twice rather than
      // replaying a stored result.
      setIdempotencyKey(newIdempotencyKey());
    } catch (caught) {
      // Only our own 90s abort is a timeout. Anything else that never reached
      // the route is a transport failure, and calling that a timeout tells the
      // visitor something untrue about a 0.4s offline request.
      const nextError =
        typeof caught === "object" &&
        caught !== null &&
        "code" in caught &&
        "message" in caught &&
        typeof caught.code === "string" &&
        typeof caught.message === "string"
          ? (caught as PublicError)
          : controller.signal.aborted
            ? {
                code: "AI_SERVICE_TIMEOUT",
                message: `Yêu cầu mất quá ${CLIENT_BUDGET_SECONDS} giây. Bấm lại nút chấm để thử lại bằng một lần chấm mới.`,
              }
            : {
                code: "AI_SERVICE_UNAVAILABLE",
                message:
                  "Không gửi được yêu cầu. Kiểm tra kết nối rồi bấm lại nút chấm.",
              };
      setError(nextError);
      setStatus("idle");
      setIdempotencyKey(newIdempotencyKey());
    } finally {
      window.clearTimeout(timeout);
    }
  };

  return (
    <main className="aihub-demo aihub-scoring scoring-page">
      <div className="app-shell">
        <div className="app-container">
          <Overview task={task} />

          <div className="lab-layout">
            <aside className="card setup-card">
              <div className="setup-intro">
                <div className="eyebrow">Bài làm mẫu</div>
                <div
                  aria-label="Chọn loại bài"
                  className="scoring-task-tabs"
                  role="tablist"
                >
                  {([1, 2] as const).map((value) => (
                    <Link
                      aria-selected={task === value}
                      className="scoring-task-tab"
                      data-testid={`tab-task-${value}`}
                      href={
                        value === 1 ? "/demo/scoring" : "/demo/scoring?task=2"
                      }
                      key={value}
                      role="tab"
                      scroll={false}
                    >
                      Task {value}
                    </Link>
                  ))}
                </div>
                <h2>
                  {task === 1 ? "Task 1 · Mô tả biểu đồ" : "Task 2 · Bài luận"}
                </h2>
                <p>
                  {task === 1
                    ? "Biểu đồ, đề bài và bài làm đã điền sẵn từ ví dụ công bố của AIHUB, nên bấm nút là chấm được ngay."
                    : "Đề bài, chủ đề và bài làm đã điền sẵn từ ví dụ công bố của AIHUB, nên bấm nút là chấm được ngay."}
                </p>
              </div>

              <div className="scoring-form">
                {task === 1 && (
                  <>
                    <label className="mini-label" htmlFor="chart-type">
                      Loại biểu đồ
                    </label>
                    <select
                      className="scoring-select"
                      data-testid="select-chart-type"
                      id="chart-type"
                      onChange={(event) =>
                        setDraft({ chartType: event.target.value })
                      }
                      value={draft.chartType}
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
                      onChange={(event) =>
                        setDraft({ imageUrl: event.target.value })
                      }
                      type="url"
                      value={draft.imageUrl}
                    />
                    <p className="scoring-help">{WRITING_TASK1_IMAGE_NOTE}</p>
                    {draft.imageUrl?.trim() ? (
                      <figure
                        className="scoring-chart-preview"
                        data-testid="scoring-chart-preview"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt="Xem trước biểu đồ sẽ chấm"
                          src={draft.imageUrl}
                        />
                        <figcaption>Ảnh sẽ được dịch vụ chấm tải.</figcaption>
                      </figure>
                    ) : null}
                  </>
                )}

                {task === 2 && (
                  <>
                    <label className="mini-label" htmlFor="topic">
                      Chủ đề
                    </label>
                    <input
                      className="question-combobox-input scoring-input"
                      data-testid="input-topic"
                      id="topic"
                      onChange={(event) =>
                        setDraft({ topic: event.target.value })
                      }
                      type="text"
                      value={draft.topic}
                    />
                    <p className="scoring-help">
                      Môn chủ đề của bài luận, tối đa 200 ký tự — khác với loại
                      biểu đồ của Task 1. Task 2 không có ảnh biểu đồ.
                    </p>
                  </>
                )}

                <label className="mini-label" htmlFor="question">
                  Đề bài
                </label>
                <textarea
                  className="scoring-textarea"
                  data-testid="input-question"
                  id="question"
                  onChange={(event) =>
                    setDraft({ question: event.target.value })
                  }
                  rows={4}
                  value={draft.question}
                />

                <label className="mini-label" htmlFor="essay">
                  Bài làm
                </label>
                <textarea
                  className="scoring-textarea scoring-essay-input"
                  data-testid="input-essay"
                  id="essay"
                  onChange={(event) => setDraft({ essay: event.target.value })}
                  rows={12}
                  value={draft.essay}
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
                    : `Chấm bài Task ${task}`}
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
                        {/* A rate limit's hint is seconds, not minutes. Rounding
                            2000ms into minutes would read "0 phút", which tells
                            the visitor nothing. */}
                        {error.retry_after_ms < 60_000
                          ? `${Math.round(error.retry_after_ms / 1000)} giây.`
                          : `${Math.round(
                              error.retry_after_ms / 60_000
                            )} phút.`}
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
                  {graded ? "live response" : "AIHUB gateway"}
                </span>
              </div>

              <div className="console">
                {graded ? (
                  <GradeReport
                    result={graded}
                    essay={draft.essay}
                    task={task}
                  />
                ) : (
                  <div className="console-empty">
                    {`// Chưa có kết quả — bấm “Chấm bài Task ${task}” để gửi bài làm mẫu lên sandbox AIHUB.`}
                  </div>
                )}
              </div>

              {graded && (
                <div className="console-footer">
                  <span>
                    <CircleCheck size={10} /> evaluation complete
                  </span>
                  <button
                    className="console-copy"
                    onClick={() => {
                      void navigator.clipboard?.writeText(
                        JSON.stringify(graded, null, 2)
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
                  <code>/v1/ielts/writing/task{task}/grade</code>
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
              <Link href={`/product/scoring/api/grade-task${task}`}>
                tài liệu Chấm bài Task {task}
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
