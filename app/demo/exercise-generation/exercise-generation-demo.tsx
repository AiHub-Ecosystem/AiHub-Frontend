"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DEFAULT_NUM_REFERENCES,
  EXERCISE_TYPE_LABELS,
  QUESTION_TYPES_BY_TASK,
  TOPICS,
  TOPIC_LABELS,
  criteriaForTask,
  errorCodesForCriterion,
  type Criterion,
  type Topic,
  type WritingTask,
} from "@/data/aiwriting";
import { ExercisePreview } from "./exercise-preview";

type ReferenceResponse = {
  topic: string;
  writing_task: number;
  criterion: string;
  error_code: string;
  references: Array<{
    question: { prompt: string; image: string | null; imageDescription: string | null; questionType: string };
    comments: Array<{ quote: string; explanation: string }>;
  }>;
};

type GenerateResponse = {
  success: boolean;
  message: string;
  data: {
    meta: {
      id: string;
      type: import("@/data/aiwriting").ExerciseType;
      ai_grading: string;
      error_code: string;
      difficulty: string;
      instruction: string;
      number_of_questions: number;
    };
    exercise: Record<string, unknown>[];
  };
};

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function curl(url: string, payload: unknown) {
  return `curl -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(payload, null, 2)}'`;
}

export function ExerciseGenerationDemo() {
  const [task, setTask] = useState<WritingTask | null>(null);
  const [topic, setTopic] = useState<Topic | "">("");
  const [criterion, setCriterion] = useState<Criterion | "">("");
  const [errorCode, setErrorCode] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [instruction, setInstruction] = useState("");

  const [openStep, setOpenStep] = useState<1 | 2 | 3>(1);
  const [backendTab, setBackendTab] = useState<1 | 2>(1);
  const [rrTab1, setRrTab1] = useState<"request" | "response">("request");
  const [rrTab2, setRrTab2] = useState<"interface" | "response" | "request">("interface");

  const [refLoading, setRefLoading] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const [refData, setRefData] = useState<ReferenceResponse | null>(null);

  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genData, setGenData] = useState<GenerateResponse | null>(null);

  const [acceptedNote, setAcceptedNote] = useState<string | null>(null);

  const criteriaOptions = task ? criteriaForTask(task) : [];
  const errorCodeOptions = criterion ? errorCodesForCriterion(criterion as Criterion) : [];
  const questionTypeOptions = task ? QUESTION_TYPES_BY_TASK[task] : [];

  function clearDownstream() {
    setRefData(null);
    setRefError(null);
    setGenData(null);
    setGenError(null);
    setAcceptedNote(null);
  }

  function handleTask(t: WritingTask) {
    setTask(t);
    setCriterion("");
    setErrorCode("");
    setQuestionType("");
    clearDownstream();
  }
  function handleTopic(v: string) {
    setTopic(v as Topic);
    clearDownstream();
  }
  function handleCriterion(v: string) {
    setCriterion(v as Criterion);
    setErrorCode("");
    clearDownstream();
  }
  function handleErrorCode(v: string) {
    setErrorCode(v);
    clearDownstream();
  }
  function handleQuestionType(v: string) {
    setQuestionType(v);
    clearDownstream();
  }
  function handleReset() {
    setTask(null);
    setTopic("");
    setCriterion("");
    setErrorCode("");
    setQuestionType("");
    setInstruction("");
    clearDownstream();
    setOpenStep(1);
    setBackendTab(1);
    setRrTab1("request");
    setRrTab2("interface");
  }

  const canQueryReferences = task !== null && topic !== "" && criterion !== "" && errorCode !== "";

  const referencesPayload = canQueryReferences
    ? {
        writingTask: task,
        topic,
        criterion,
        errorCode,
        questionType: questionType || undefined,
        numReferences: DEFAULT_NUM_REFERENCES,
      }
    : null;

  async function handleQueryReferences() {
    if (!referencesPayload) return;
    setRefLoading(true);
    setRefError(null);
    setBackendTab(1);
    setRrTab1("request");
    try {
      const res = await fetch("/api/demo/exercise-generation/references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(referencesPayload),
      });
      const json = await res.json();
      if (!res.ok) {
        setRefError(json.detail?.[0]?.msg ?? "Yêu cầu không hợp lệ.");
        return;
      }
      setRefData(json);
      setRrTab1("response");
      setOpenStep(2);
    } catch {
      setRefError("Không gọi được API (lỗi mạng).");
    } finally {
      setRefLoading(false);
    }
  }

  // sample-references trả `criterion` dạng display name ("Lexical Resource"),
  // không phải enum — xem docs/design/2026-08-15-demo-page-spec.md mục 6.7.
  // Ta vẫn còn enum gốc trong state `criterion` nên dùng thẳng, không cần suy
  // ngược từ label — nhưng nếu chỉ có response của bước 1 trong tay thì đây
  // chính là chỗ phải map ngược trước khi gọi bước 2.
  const generatePayload = refData
    ? { topic, writingTask: task, criterion, errorCode, instruction, references: refData.references }
    : null;

  async function handleGenerate() {
    if (!generatePayload) return;
    setGenLoading(true);
    setGenError(null);
    setBackendTab(2);
    setRrTab2("interface");
    try {
      const res = await fetch("/api/demo/exercise-generation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generatePayload),
      });
      const json = await res.json();
      if (!res.ok) {
        setGenError(json.detail?.[0]?.msg ?? "Yêu cầu không hợp lệ.");
        return;
      }
      setGenData(json);
      setRrTab2("interface");
      setOpenStep(3);
    } catch {
      setGenError("Không gọi được API (lỗi mạng).");
    } finally {
      setGenLoading(false);
    }
  }

  function handleAccept() {
    setAcceptedNote("Đã lưu bản nháp này. (Demo — chưa nối kho lưu trữ thật.)");
  }
  function handleRetry() {
    setAcceptedNote(null);
    handleGenerate();
  }

  return (
    <div className="aihub aihub--flush">
      <div className="aihub-shell">
        <nav className="aihub-crumbs-static flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/demo">Danh mục sản phẩm</Link>
            <span aria-hidden="true">/</span>
            <span>Tạo bài tập</span>
          </div>
          <Link
            href="/lab"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-bold hover:bg-brand-blue/20 transition-colors"
          >
            <span>🧪 Vào Phòng Lab Academic</span>
            <span>→</span>
          </Link>
        </nav>

        <div className="aihub-split">
          {/* Cột trái — thao tác như sản phẩm thật */}
          <div className="aihub-split-left">
            <p className="aihub-crumb-static">Các bước tích hợp API</p>
            <h1 className="aihub-title">Tạo bài tập</h1>
            <p className="aihub-lede">
              Demo các bước tích hợp giải pháp Tạo bài tập của AIHub — chọn tiêu chí, lấy dữ liệu
              tham chiếu, rồi sinh bài tập bám đúng lỗi cần luyện.
            </p>

            <div className="aihub-accordion">
              {/* Bước 1 */}
              <div className="aihub-astep">
                <button
                  type="button"
                  className="aihub-astep-head"
                  aria-expanded={openStep === 1}
                  data-done={canQueryReferences}
                  onClick={() => setOpenStep(1)}
                >
                  <span className="aihub-astep-num">1</span>
                  <span className="aihub-astep-title">Chọn tiêu chí luyện tập</span>
                  <ChevronIcon className="aihub-astep-chevron" />
                </button>
                {openStep === 1 && (
                  <div className="aihub-astep-body">
                    <div className="aihub-fieldset">
                      <span className="aihub-fieldset-label">Task</span>
                      <div className="aihub-checkrow">
                        <label className="aihub-check">
                          <input type="checkbox" checked={task === 1} onChange={() => handleTask(1)} />
                          Task 1
                        </label>
                        <label className="aihub-check">
                          <input type="checkbox" checked={task === 2} onChange={() => handleTask(2)} />
                          Task 2
                        </label>
                      </div>
                    </div>

                    <div className="aihub-fieldset">
                      <label className="aihub-fieldset-label" htmlFor="f-topic">
                        Topic
                      </label>
                      <select
                        id="f-topic"
                        className="aihub-select"
                        value={topic}
                        onChange={(e) => handleTopic(e.target.value)}
                      >
                        <option value="">Select Topic</option>
                        {TOPICS.map((t) => (
                          <option key={t} value={t}>
                            {TOPIC_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="aihub-fieldset">
                      <label className="aihub-fieldset-label" htmlFor="f-criterion">
                        Criteria
                      </label>
                      <select
                        id="f-criterion"
                        className="aihub-select"
                        value={criterion}
                        disabled={!task}
                        onChange={(e) => handleCriterion(e.target.value)}
                      >
                        <option value="">{task ? "Select Criteria" : "Select Task first"}</option>
                        {criteriaOptions.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="aihub-fieldset">
                      <label className="aihub-fieldset-label" htmlFor="f-error">
                        Error Code
                      </label>
                      <select
                        id="f-error"
                        className="aihub-select"
                        value={errorCode}
                        disabled={!criterion}
                        onChange={(e) => handleErrorCode(e.target.value)}
                      >
                        <option value="">{criterion ? "Select Error Code" : "Select Criteria first"}</option>
                        {errorCodeOptions.map((e) => (
                          <option key={e.value} value={e.value}>
                            {e.label} ({e.value})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="aihub-fieldset">
                      <label className="aihub-fieldset-label" htmlFor="f-qtype">
                        Question Type{" "}
                        <span className="aihub-fieldset-hint">(filters sample references, not sent to AI)</span>
                      </label>
                      <select
                        id="f-qtype"
                        className="aihub-select"
                        value={questionType}
                        disabled={!task}
                        onChange={(e) => handleQuestionType(e.target.value)}
                      >
                        <option value="">Any</option>
                        {questionTypeOptions.map((q) => (
                          <option key={q.value} value={q.value}>
                            {q.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        className="aihub-btn aihub-btn--accent"
                        disabled={!canQueryReferences || refLoading}
                        onClick={handleQueryReferences}
                      >
                        {refLoading ? "Querying…" : "Query reference"}
                      </button>
                      <button type="button" className="aihub-btn aihub-btn--ghost" onClick={handleReset}>
                        Reset
                      </button>
                    </div>
                    {refError && <p className="aihub-error-text">{refError}</p>}
                  </div>
                )}
              </div>

              {/* Bước 2 */}
              <div className="aihub-astep">
                <button
                  type="button"
                  className="aihub-astep-head"
                  aria-expanded={openStep === 2}
                  data-done={!!refData}
                  disabled={!refData}
                  onClick={() => refData && setOpenStep(2)}
                >
                  <span className="aihub-astep-num">2</span>
                  <span className="aihub-astep-title">Xem dữ liệu tham chiếu</span>
                  <ChevronIcon className="aihub-astep-chevron" />
                </button>
                {openStep === 2 && refData && (
                  <div className="aihub-astep-body">
                    <div className="aihub-fieldset">
                      <label className="aihub-fieldset-label" htmlFor="f-instruction">
                        Detailed Instruction <span className="aihub-fieldset-hint">(tuỳ chọn)</span>
                      </label>
                      <textarea
                        id="f-instruction"
                        className="aihub-textarea"
                        placeholder="Ví dụ: nhấn mạnh vào ngữ cảnh học thuật"
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                      />
                    </div>

                    <div className="aihub-reflist">
                      {refData.references.map((r, i) => (
                        <div className="aihub-refcard" key={i}>
                          <p className="aihub-refcard-label">
                            Reference #{i + 1} · {r.question.questionType}
                          </p>
                          <p className="aihub-refcard-prompt">“{r.question.prompt}”</p>
                          {r.question.image && (
                            <p className="aihub-refcard-img">Ảnh: {r.question.image}</p>
                          )}
                          {r.question.imageDescription && (
                            <p className="aihub-refcard-img">{r.question.imageDescription}</p>
                          )}
                          {r.comments.map((c, ci) => (
                            <div key={ci}>
                              <p className="aihub-refcard-quote">“{c.quote}”</p>
                              <p className="aihub-refcard-explain">{c.explanation}</p>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="aihub-btn aihub-btn--accent"
                      style={{ marginTop: 16 }}
                      disabled={genLoading}
                      onClick={handleGenerate}
                    >
                      {genLoading ? "Đang tạo bài tập…" : "Tạo bài tập"}
                    </button>
                    {genError && <p className="aihub-error-text">{genError}</p>}
                  </div>
                )}
              </div>

              {/* Bước 3 */}
              <div className="aihub-astep">
                <button
                  type="button"
                  className="aihub-astep-head"
                  aria-expanded={openStep === 3}
                  data-done={!!genData}
                  disabled={!genData}
                  onClick={() => genData && setOpenStep(3)}
                >
                  <span className="aihub-astep-num">3</span>
                  <span className="aihub-astep-title">Xem trước &amp; quyết định</span>
                  <ChevronIcon className="aihub-astep-chevron" />
                </button>
                {openStep === 3 && genData && (
                  <div className="aihub-astep-body">
                    <div
                      style={{
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: "10px",
                        padding: "14px 16px",
                        marginBottom: "16px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            background: "#22c55e",
                            color: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 800,
                          }}
                        >
                          ✓
                        </span>
                        <strong style={{ color: "#166534", fontSize: "13.5px" }}>
                          Đã tạo bộ bài tập thành công!
                        </strong>
                      </div>
                      <p style={{ margin: "0 0 10px", fontSize: "12.5px", color: "#15803d", lineHeight: "1.5" }}>
                        Dữ liệu bài tập trực quan (Interface) và Response JSON đầy đủ đã sẵn sàng ở cột bên phải.
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        <span
                          style={{
                            background: "#ffffff",
                            color: "#166534",
                            border: "1px solid #86efac",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11.5px",
                            fontWeight: 600,
                          }}
                        >
                          {genData.data.meta.number_of_questions} câu hỏi
                        </span>
                        <span
                          style={{
                            background: "#ffffff",
                            color: "#166534",
                            border: "1px solid #86efac",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11.5px",
                            fontWeight: 600,
                          }}
                        >
                          Độ khó {genData.data.meta.difficulty}
                        </span>
                        <span
                          style={{
                            background: "#ffffff",
                            color: "#166534",
                            border: "1px solid #86efac",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11.5px",
                            fontWeight: 600,
                          }}
                        >
                          {EXERCISE_TYPE_LABELS[genData.data.meta.type] || genData.data.meta.type}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                      <button type="button" className="aihub-btn" onClick={handleAccept}>
                        Accept
                      </button>
                      <button
                        type="button"
                        className="aihub-btn aihub-btn--ghost"
                        disabled={genLoading}
                        onClick={handleRetry}
                      >
                        Retry
                      </button>
                    </div>
                    {acceptedNote && (
                      <p className="aihub-explain" style={{ marginTop: 12, borderLeft: "3px solid #10b981" }}>
                        {acceptedNote}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cột phải — các bước backend chạy */}
          <div className="aihub-split-right">
            <div className="aihub-card-top" style={{ marginBottom: 4 }}>
              <h2 className="aihub-category-name" style={{ margin: 0 }}>
                AIHub Demo — Tạo bài tập
              </h2>
              <span className="aihub-badge" data-status="stable">
                Stable
              </span>
            </div>
            <p className="aihub-sublabel">
              Đúng những lệnh gọi mà backend thực hiện cho thao tác bên trái. Đây là dữ liệu mock —
              chưa gọi AI hay DB thật.
            </p>

            <div className="aihub-tabs">
              <button
                type="button"
                className="aihub-tab"
                role="tab"
                aria-selected={backendTab === 1}
                onClick={() => setBackendTab(1)}
              >
                1 Lấy reference
              </button>
              <button
                type="button"
                className="aihub-tab"
                role="tab"
                aria-selected={backendTab === 2}
                onClick={() => setBackendTab(2)}
              >
                2 Sinh bài tập
              </button>
            </div>

            {backendTab === 1 && (
              <div>
                <div className="aihub-callout">
                  Gọi <code>POST /external/micro-exercise/sample-references</code> với
                  writing_task, topic, criterion, error_code để lấy các bài làm thật chứa đúng lỗi
                  cần luyện.
                </div>
                <div className="aihub-tabs">
                  <button
                    type="button"
                    className="aihub-tab aihub-tab--sub"
                    role="tab"
                    aria-selected={rrTab1 === "request"}
                    onClick={() => setRrTab1("request")}
                  >
                    Request
                  </button>
                  <button
                    type="button"
                    className="aihub-tab aihub-tab--sub"
                    role="tab"
                    aria-selected={rrTab1 === "response"}
                    onClick={() => setRrTab1("response")}
                  >
                    Response
                  </button>
                </div>
                {rrTab1 === "request" ? (
                  referencesPayload ? (
                    <pre className="aihub-code">
                      {curl(
                        "https://testbackend.aihubproduction.com/external/micro-exercise/sample-references",
                        referencesPayload,
                      )}
                    </pre>
                  ) : (
                    <div className="aihub-code-placeholder">
                      Chọn đủ Task, Topic, Criteria, Error Code ở bên trái để dựng request.
                    </div>
                  )
                ) : refData ? (
                  <pre className="aihub-code">{JSON.stringify(refData, null, 2)}</pre>
                ) : (
                  <div className="aihub-code-placeholder">
                    Chưa gọi — bấm “Query reference” ở bên trái.
                  </div>
                )}
              </div>
            )}

            {backendTab === 2 && (
              <div>
                <div className="aihub-callout">
                  Gọi <code>POST /create-micro-exercise</code> với reference vừa lấy được. Dạng bài
                  và số câu do <code>error_code</code> quyết định, không cần chọn tay.
                </div>
                <div className="aihub-tabs">
                  <button
                    type="button"
                    className="aihub-tab aihub-tab--sub"
                    role="tab"
                    aria-selected={rrTab2 === "interface"}
                    onClick={() => setRrTab2("interface")}
                  >
                    Interface
                  </button>
                  <button
                    type="button"
                    className="aihub-tab aihub-tab--sub"
                    role="tab"
                    aria-selected={rrTab2 === "response"}
                    onClick={() => setRrTab2("response")}
                  >
                    Response
                  </button>
                  <button
                    type="button"
                    className="aihub-tab aihub-tab--sub"
                    role="tab"
                    aria-selected={rrTab2 === "request"}
                    onClick={() => setRrTab2("request")}
                  >
                    Request
                  </button>
                </div>

                {rrTab2 === "interface" && (
                  <div>
                    {genData ? (
                      <ExercisePreview meta={genData.data.meta} exercise={genData.data.exercise} />
                    ) : (
                      <div className="aihub-code-placeholder">
                        Chưa có dữ liệu bài tập — bấm “Tạo bài tập” ở Bước 2 bên trái.
                      </div>
                    )}
                  </div>
                )}

                {rrTab2 === "response" && (
                  <div>
                    {genData ? (
                      <pre className="aihub-code">{JSON.stringify(genData, null, 2)}</pre>
                    ) : (
                      <div className="aihub-code-placeholder">
                        Chưa gọi — bấm “Tạo bài tập” ở bên trái.
                      </div>
                    )}
                  </div>
                )}

                {rrTab2 === "request" && (
                  <div>
                    {generatePayload ? (
                      <pre className="aihub-code">
                        {curl(
                          "https://test-api-ielts-writing.aihubproduction.com/create-micro-exercise",
                          generatePayload,
                        )}
                      </pre>
                    ) : (
                      <div className="aihub-code-placeholder">Cần lấy dữ liệu tham chiếu trước.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
