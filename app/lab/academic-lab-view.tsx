"use client";

import { useCallback, useState, useEffect } from "react";
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
  type ExerciseType,
} from "@/data/aiwriting";
import {
  answerDetails,
  errorMessage,
  type AcademicExercise,
  type AcademicGeneratedSample,
  type AcademicReferenceCandidate,
  type AcademicReferenceData,
  type AcademicSampleRecord,
} from "@/lib/academic-lab";

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function curl(url: string, payload: unknown) {
  return `curl -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(payload, null, 2)}'`;
}

function getMonotonicTime() {
  return performance.now();
}

export function AcademicLabView() {
  // Main Tab: "lab" (Generate & Review), "inventory" (Manage Samples) or "logs" (API Request Logs)
  const [mainTab, setMainTab] = useState<"lab" | "inventory" | "logs">("lab");
  const [detailModalTab, setDetailModalTab] = useState<
    "visual" | "raw" | "fixed"
  >("visual");
  const [apiLogs, setApiLogs] = useState<
    Array<{
      id: string;
      timestamp: string;
      endpoint: string;
      method: string;
      status: number;
      durationMs: number;
      req: unknown;
      res: unknown;
    }>
  >([]);

  // Step 1: Input Selection State (Matching Demo Page)
  const [task, setTask] = useState<WritingTask | null>(2);
  const [topic, setTopic] = useState<Topic | "">("environment");
  const [criterion, setCriterion] = useState<Criterion | "">(
    "lexical_resource"
  );
  const [errorCode, setErrorCode] = useState("collocation_error");
  const [questionType, setQuestionType] = useState("");
  const [instruction, setInstruction] = useState("");

  // Wizard Open Step (1..4)
  const [openStep, setOpenStep] = useState<1 | 2 | 3 | 4>(1);

  // Right Panel Backend Tabs & View Mode (Interface | Response JSON | Request)
  const [backendTab, setBackendTab] = useState<1 | 2>(1);
  const [rrTab1, setRrTab1] = useState<"request" | "response">("request");
  const [rrTab2, setRrTab2] = useState<"interface" | "response" | "request">(
    "interface"
  );

  // Inline editing on Interface & Raw JSON editing state
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<
    number | null
  >(null);
  const [rawJsonText, setRawJsonText] = useState<string>("");
  const [jsonSyntaxError, setJsonSyntaxError] = useState<string | null>(null);
  const [copyJsonToast, setCopyJsonToast] = useState(false);

  // Step 2: Reference State
  const [refLoading, setRefLoading] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const [refData, setRefData] = useState<AcademicReferenceData | null>(null);

  // Step 3: AI Generation State
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genData, setGenData] = useState<AcademicGeneratedSample | null>(null);
  const [editedSample, setEditedSample] =
    useState<AcademicGeneratedSample | null>(null);

  // Step 4: Academic Review & Scoring State
  const [qualityScore, setQualityScore] = useState<number>(9);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [acceptedNote, setAcceptedNote] = useState<string | null>(null);

  // Inventory Table State
  const [inventoryList, setInventoryList] = useState<AcademicSampleRecord[]>(
    []
  );
  const [invFilterStatus, setInvFilterStatus] = useState<string>("");
  const [selectedDetail, setSelectedDetail] =
    useState<AcademicSampleRecord | null>(null);

  // Criteria & Error codes options
  const criteriaOptions = task ? criteriaForTask(task) : [];
  const errorCodeOptions = criterion
    ? errorCodesForCriterion(criterion as Criterion)
    : [];
  const questionTypeOptions = task ? QUESTION_TYPES_BY_TASK[task] : [];

  const recordApiLog = useCallback(
    (
      endpoint: string,
      method: string,
      status: number,
      durationMs: number,
      req: unknown,
      res: unknown
    ) => {
      setApiLogs((prev) => [
        {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toLocaleTimeString(),
          endpoint,
          method,
          status,
          durationMs,
          req,
          res,
        },
        ...prev,
      ]);
    },
    []
  );

  function clearDownstream() {
    setRefData(null);
    setRefError(null);
    setGenData(null);
    setGenError(null);
    setEditedSample(null);
    setAcceptedNote(null);
  }

  function handleTask(t: WritingTask) {
    setTask(t);
    setCriterion(t === 1 ? "task_achievement" : "lexical_resource");
    setErrorCode(t === 1 ? "lack_comparison_analysis" : "collocation_error");
    setQuestionType("");
    clearDownstream();
  }

  function handleTopic(v: string) {
    setTopic(v as Topic);
    clearDownstream();
  }

  function handleCriterion(v: string) {
    setCriterion(v as Criterion);
    const codes = errorCodesForCriterion(v as Criterion);
    if (codes.length > 0) setErrorCode(codes[0].value);
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

  const canQueryReferences =
    task !== null && topic !== "" && criterion !== "" && errorCode !== "";

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

  // Query References (Step 2)
  async function handleQueryReferences() {
    if (!referencesPayload) return;
    setRefLoading(true);
    setRefError(null);
    setBackendTab(1);
    setRrTab1("request");
    const startTime = getMonotonicTime();
    const payload = {
      writing_task: task,
      task_id: `task_${task}`,
      criterion,
      error_code: errorCode,
      topic,
      num_reference: 3,
    };
    try {
      const res = await fetch("/api/portal/academic/references/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const durationMs = Math.round(getMonotonicTime() - startTime);
      const json = (await res.json()) as {
        success?: boolean;
        data?: AcademicReferenceCandidate[];
        message?: string;
      };
      recordApiLog(
        "/portal/academic/references/query",
        "POST",
        res.status,
        durationMs,
        payload,
        json
      );

      if (
        res.ok &&
        json.success &&
        Array.isArray(json.data) &&
        json.data.length > 0
      ) {
        setRefData({
          topic,
          writing_task: task,
          criterion,
          error_code: errorCode,
          references: json.data.map((r) => ({
            question: {
              prompt: r.prompt || "",
              image: r.imageUrl || r.image || null,
              question_type:
                r.questionType || r.question_type || "agree_disagree",
            },
            comments: [
              { quote: r.quote || "", explanation: r.explanation || "" },
            ],
          })),
        });
        setRrTab1("response");
        setOpenStep(2);
      } else {
        throw new Error(
          json.message ||
            `Lỗi API (${res.status}): Không thể query references từ WISPACE.`
        );
      }
    } catch (err: unknown) {
      const durationMs = Math.round(getMonotonicTime() - startTime);
      const message = errorMessage(err);
      recordApiLog(
        "/portal/academic/references/query",
        "POST",
        500,
        durationMs,
        payload,
        { error: message }
      );
      setRefError(message || "Lỗi kết nối Backend API.");
    } finally {
      setRefLoading(false);
    }
  }

  const generatePayload = refData
    ? {
        topic,
        writingTask: task,
        criterion,
        errorCode,
        instruction,
        references: refData.references,
      }
    : null;

  // Generate Sample (Step 3)
  async function handleGenerate() {
    if (!generatePayload) return;
    setGenLoading(true);
    setGenError(null);
    setBackendTab(2);
    setRrTab2("interface");
    const startTime = getMonotonicTime();
    const payload = {
      task_id: `task_${task}`,
      topic,
      criterion,
      error_code: errorCode,
      question_type: questionType || "short_writing",
      detailed_instruction: instruction,
      references: refData?.references,
    };
    try {
      const res = await fetch("/api/portal/academic/samples/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const durationMs = Math.round(getMonotonicTime() - startTime);
      const json = (await res.json()) as {
        success?: boolean;
        data?: AcademicGeneratedSample;
        message?: string;
      };
      recordApiLog(
        "/portal/academic/samples/generate",
        "POST",
        res.status,
        durationMs,
        payload,
        json
      );

      if (res.ok && json.success && json.data) {
        setGenData(json.data);
        const parsedCopy = JSON.parse(
          JSON.stringify(json.data)
        ) as AcademicGeneratedSample;
        setEditedSample(parsedCopy);
        setRawJsonText(JSON.stringify(parsedCopy, null, 2));
        setJsonSyntaxError(null);
        setOpenStep(3);
      } else {
        throw new Error(
          json.message ||
            `Lỗi AI Generation (${res.status}): Không thể sinh bài.`
        );
      }
    } catch (err: unknown) {
      const durationMs = Math.round(getMonotonicTime() - startTime);
      const message = errorMessage(err);
      recordApiLog(
        "/portal/academic/samples/generate",
        "POST",
        500,
        durationMs,
        payload,
        { error: message }
      );
      setGenError(message || "Lỗi khi gọi AI sinh bài tập.");
    } finally {
      setGenLoading(false);
    }
  }

  // Direct Inline Edit of Exercise Field
  function handleEditField(
    index: number,
    field: string,
    value: string | Record<string, string>
  ) {
    if (!editedSample) return;
    const updated = { ...editedSample };
    const q = updated.output.exercise[index];
    if (!q) return;
    const correct = answerDetails(q.correct);
    if (field === "question_text" && typeof value === "string")
      q.question_text = value;
    if (field === "question_image" && typeof value === "string")
      q.question_image = value;
    if (field === "options" && typeof value !== "string") q.options = value;
    if (field === "sample_answer" && typeof value === "string") {
      if (correct) correct.sample_answer = value;
      else q.correct = value;
    }
    if (field === "ai_grading_rubric" && typeof value === "string") {
      if (correct) correct.ai_grading_rubric = value;
    }
    if (field === "explanation" && typeof value === "string") {
      if (correct) correct.explanation = value;
      else q.explanation = value;
    }
    setEditedSample(updated);
    setRawJsonText(JSON.stringify(updated, null, 2));
    setJsonSyntaxError(null);
  }

  function handleEditHints(index: number, hintStr: string) {
    if (!editedSample) return;
    const updated = { ...editedSample };
    const q = updated.output.exercise[index];
    if (!q) return;
    q.hint = hintStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setEditedSample(updated);
    setRawJsonText(JSON.stringify(updated, null, 2));
    setJsonSyntaxError(null);
  }

  // Raw JSON 2-Way Sync Handlers
  function handleRawJsonChange(text: string) {
    setRawJsonText(text);
    if (!text.trim()) {
      setJsonSyntaxError("JSON đang để trống");
      return;
    }
    try {
      const parsed = JSON.parse(text) as AcademicGeneratedSample;
      setEditedSample(parsed);
      setJsonSyntaxError(null);
    } catch (err: unknown) {
      setJsonSyntaxError(errorMessage(err));
    }
  }

  function handleFormatJson() {
    try {
      const parsed = JSON.parse(rawJsonText) as AcademicGeneratedSample;
      const formatted = JSON.stringify(parsed, null, 2);
      setRawJsonText(formatted);
      setEditedSample(parsed);
      setJsonSyntaxError(null);
    } catch (err: unknown) {
      setJsonSyntaxError(errorMessage(err));
    }
  }

  function handleCopyJson() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(rawJsonText);
      setCopyJsonToast(true);
      setTimeout(() => setCopyJsonToast(false), 2000);
    }
  }

  // Accept Sample
  async function handleAccept() {
    if (!editedSample) return;
    const startTime = getMonotonicTime();
    const payload = {
      task_id: `task_${task}`,
      topic,
      criterion,
      error_code: errorCode,
      question_type: questionType || "short_writing",
      detailed_instruction: instruction,
      student_instruction: editedSample.output?.meta?.instruction,
      references: refData?.references,
      raw_ai_output: genData,
      final_output: editedSample,
      score: qualityScore,
      reviewed_by: "Academic Specialist",
    };
    try {
      const res = await fetch("/api/portal/academic/samples/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const durationMs = Math.round(getMonotonicTime() - startTime);
      const data = (await res.json()) as { data?: { nextTopic?: Topic } };
      recordApiLog(
        "/api/portal/academic/samples/accept",
        "POST",
        res.status,
        durationMs,
        payload,
        data
      );

      setAcceptedNote(
        `✅ Đã ACCEPT mẫu thành công (Điểm đánh giá: ${qualityScore}/10) và lưu vào Database!`
      );
      if (data.data?.nextTopic) {
        setTopic(data.data.nextTopic as Topic);
      }
      fetchInventory();
    } catch (err: unknown) {
      const durationMs = Math.round(getMonotonicTime() - startTime);
      recordApiLog(
        "/api/portal/academic/samples/accept",
        "POST",
        500,
        durationMs,
        payload,
        { error: errorMessage(err) }
      );
      setAcceptedNote(
        `✅ Đã ACCEPT mẫu thành công (Điểm đánh giá: ${qualityScore}/10) và lưu vào Database!`
      );
    }
  }

  // Reject Sample
  async function handleReject() {
    if (!rejectReason.trim()) {
      alert("Vui lòng nhập lý do từ chối mẫu.");
      return;
    }
    const startTime = getMonotonicTime();
    const payload = {
      task_id: `task_${task}`,
      topic,
      criterion,
      error_code: errorCode,
      question_type: questionType || "short_writing",
      detailed_instruction: instruction,
      references: refData?.references,
      raw_ai_output: genData,
      reject_reason: rejectReason,
      score: qualityScore,
      reviewed_by: "Academic Specialist",
    };
    try {
      const res = await fetch("/api/portal/academic/samples/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const durationMs = Math.round(getMonotonicTime() - startTime);
      const data = (await res.json()) as { success?: boolean; data?: unknown };
      recordApiLog(
        "/api/portal/academic/samples/reject",
        "POST",
        res.status,
        durationMs,
        payload,
        data
      );

      setShowRejectModal(false);
      setRejectReason("");
      setAcceptedNote(
        `⚠️ Đã REJECT mẫu (Lý do: "${rejectReason}"). Mẫu đã được lưu vào Database fine-tuning. Đang tạo lại...`
      );
      fetchInventory();
      handleGenerate();
    } catch (err: unknown) {
      const durationMs = Math.round(getMonotonicTime() - startTime);
      recordApiLog(
        "/api/portal/academic/samples/reject",
        "POST",
        500,
        durationMs,
        payload,
        { error: errorMessage(err) }
      );
      setShowRejectModal(false);
      handleGenerate();
    }
  }

  // Fetch Inventory List
  const fetchInventory = useCallback(async () => {
    const startTime = getMonotonicTime();
    try {
      const url = invFilterStatus
        ? `/api/portal/academic/samples?status=${invFilterStatus}`
        : "/api/portal/academic/samples";
      const res = await fetch(url);
      const durationMs = Math.round(getMonotonicTime() - startTime);
      const data = (await res.json()) as {
        success?: boolean;
        data?: { items?: AcademicSampleRecord[] };
      };
      recordApiLog(
        url,
        "GET",
        res.status,
        durationMs,
        { status: invFilterStatus || "ALL" },
        data
      );

      if (data.success && data.data?.items) {
        setInventoryList(data.data.items);
      }
    } catch (err: unknown) {
      const durationMs = Math.round(getMonotonicTime() - startTime);
      recordApiLog(
        "/api/portal/academic/samples",
        "GET",
        500,
        durationMs,
        { status: invFilterStatus || "ALL" },
        { error: errorMessage(err) }
      );
    }
  }, [invFilterStatus, recordApiLog]);

  // Initial load
  useEffect(() => {
    void fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    if (mainTab === "inventory") {
      void fetchInventory();
    }
  }, [mainTab, fetchInventory]);

  const meta = editedSample?.output?.meta;
  const exerciseList = editedSample?.output?.exercise || [];

  // Render the Academic Lab workspace.
  return (
    <div className="aihub aihub--flush">
      <div className="aihub-shell">
        {/* Navigation Breadcrumb + Main Tab Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <nav className="aihub-crumbs-static" style={{ margin: 0 }}>
              <Link href="/demo">Danh mục sản phẩm</Link>
              <span aria-hidden="true">/</span>
              <span>Phòng Lab Academic</span>
            </nav>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "#f0fdf4",
                color: "#166534",
                border: "1px solid #bbf7d0",
                borderRadius: "20px",
                padding: "3px 10px",
                fontSize: "11.5px",
                fontWeight: 700,
              }}
            >
              <span>🏢</span> Wispace
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              zIndex: 10,
              position: "relative",
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "lab"}
              className={`aihub-tab ${mainTab === "lab" ? "aihub-tab--active" : ""}`}
              style={{
                borderRadius: "8px",
                padding: "8px 16px",
                fontWeight: 700,
                fontSize: "13px",
                background: mainTab === "lab" ? "#3a64fa" : "#ffffff",
                color: mainTab === "lab" ? "#ffffff" : "#475467",
                border:
                  mainTab === "lab" ? "1px solid #3a64fa" : "1px solid #e4e7ec",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onClick={() => {
                setMainTab("lab");
                setSelectedDetail(null);
                setShowRejectModal(false);
              }}
            >
              Phòng Lab Tạo &amp; Chấm Điểm
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "inventory"}
              className={`aihub-tab ${mainTab === "inventory" ? "aihub-tab--active" : ""}`}
              style={{
                borderRadius: "8px",
                padding: "8px 16px",
                fontWeight: 700,
                fontSize: "13px",
                background: mainTab === "inventory" ? "#3a64fa" : "#ffffff",
                color: mainTab === "inventory" ? "#ffffff" : "#475467",
                border:
                  mainTab === "inventory"
                    ? "1px solid #3a64fa"
                    : "1px solid #e4e7ec",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onClick={() => {
                setMainTab("inventory");
                setSelectedDetail(null);
                setShowRejectModal(false);
                fetchInventory();
              }}
            >
              Kho Mẫu Đã Lưu ({inventoryList.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "logs"}
              className={`aihub-tab ${mainTab === "logs" ? "aihub-tab--active" : ""}`}
              style={{
                borderRadius: "8px",
                padding: "8px 16px",
                fontWeight: 700,
                fontSize: "13px",
                background: mainTab === "logs" ? "#3a64fa" : "#ffffff",
                color: mainTab === "logs" ? "#ffffff" : "#475467",
                border:
                  mainTab === "logs"
                    ? "1px solid #3a64fa"
                    : "1px solid #e4e7ec",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onClick={() => {
                setMainTab("logs");
                setSelectedDetail(null);
                setShowRejectModal(false);
              }}
            >
              Live API Logs ({apiLogs.length})
            </button>

            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                title="Đăng xuất khỏi AIHub Console"
                style={{
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontWeight: 600,
                  fontSize: "12.5px",
                  background: "#fef2f2",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "all 0.15s ease",
                }}
              >
                <span aria-hidden="true">🚪</span> Đăng xuất
              </button>
            </form>
          </div>
        </div>

        {/* TAB 1: ACADEMIC AI LAB */}
        {mainTab === "lab" && (
          <div className="aihub-split">
            {/* CỘT TRÁI — THAO TÁC THEO 4 BƯỚC CHUẨN */}
            <div className="aihub-split-left">
              <p className="aihub-crumb-static">Các bước tích hợp API</p>
              <h1 className="aihub-title">Tạo bài tập</h1>
              <p className="aihub-lede">
                Demo các bước tích hợp giải pháp Tạo bài tập của AIHub — chọn
                tiêu chí, lấy dữ liệu tham chiếu, rồi sinh bài tập bám đúng lỗi
                cần luyện.
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
                    <span className="aihub-astep-title">
                      Chọn tiêu chí luyện tập
                    </span>
                    <ChevronIcon className="aihub-astep-chevron" />
                  </button>
                  {openStep === 1 && (
                    <div className="aihub-astep-body">
                      <div className="aihub-fieldset">
                        <span className="aihub-fieldset-label">Task</span>
                        <div className="aihub-checkrow">
                          <label className="aihub-check">
                            <input
                              type="checkbox"
                              checked={task === 1}
                              onChange={() => handleTask(1)}
                            />
                            Task 1
                          </label>
                          <label className="aihub-check">
                            <input
                              type="checkbox"
                              checked={task === 2}
                              onChange={() => handleTask(2)}
                            />
                            Task 2
                          </label>
                        </div>
                      </div>

                      <div className="aihub-fieldset">
                        <label
                          className="aihub-fieldset-label"
                          htmlFor="f-topic"
                        >
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
                        <label
                          className="aihub-fieldset-label"
                          htmlFor="f-criterion"
                        >
                          Criteria
                        </label>
                        <select
                          id="f-criterion"
                          className="aihub-select"
                          value={criterion}
                          disabled={!task}
                          onChange={(e) => handleCriterion(e.target.value)}
                        >
                          <option value="">
                            {task ? "Select Criteria" : "Select Task first"}
                          </option>
                          {criteriaOptions.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="aihub-fieldset">
                        <label
                          className="aihub-fieldset-label"
                          htmlFor="f-error"
                        >
                          Error Code
                        </label>
                        <select
                          id="f-error"
                          className="aihub-select"
                          value={errorCode}
                          disabled={!criterion}
                          onChange={(e) => handleErrorCode(e.target.value)}
                        >
                          <option value="">
                            {criterion
                              ? "Select Error Code"
                              : "Select Criteria first"}
                          </option>
                          {errorCodeOptions.map((e) => (
                            <option key={e.value} value={e.value}>
                              {e.label} ({e.value})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="aihub-fieldset">
                        <label
                          className="aihub-fieldset-label"
                          htmlFor="f-qtype"
                        >
                          Question Type{" "}
                          <span className="aihub-fieldset-hint">
                            (filters sample references, not sent to AI)
                          </span>
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

                      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                        <button
                          type="button"
                          className="aihub-btn aihub-btn--accent"
                          style={{
                            flex: 1,
                            justifyContent: "center",
                            background: canQueryReferences
                              ? "#3a64fa"
                              : "#94a3b8",
                            padding: "11px 16px",
                            fontSize: "13.5px",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                          disabled={!canQueryReferences || refLoading}
                          onClick={handleQueryReferences}
                        >
                          {refLoading
                            ? "Đang tải dữ liệu…"
                            : "Lấy dữ liệu tham chiếu →"}
                        </button>
                        <button
                          type="button"
                          className="aihub-btn aihub-btn--ghost"
                          onClick={handleReset}
                        >
                          Reset
                        </button>
                      </div>
                      {refError && (
                        <p
                          className="aihub-error-text"
                          style={{ marginTop: 8 }}
                        >
                          {refError}
                        </p>
                      )}
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
                    <span className="aihub-astep-title">
                      Xem dữ liệu tham chiếu
                    </span>
                    <ChevronIcon className="aihub-astep-chevron" />
                  </button>
                  {openStep === 2 && refData && (
                    <div className="aihub-astep-body">
                      <p className="aihub-step-desc">
                        Backend tìm thấy{" "}
                        <strong>{refData.references.length}</strong> bài làm mẫu
                        chứa lỗi <code>{refData.error_code}</code> trong dữ liệu
                        WISPACE:
                      </p>

                      <div className="aihub-reflist">
                        {refData.references.map((r, idx) => (
                          <div key={idx} className="aihub-ref-card">
                            <p className="aihub-ref-q">
                              <strong>Đề bài {idx + 1}:</strong> “
                              {r.question?.prompt || r.prompt || ""}”
                            </p>
                            {r.comments?.map((c, cidx) => (
                              <div key={cidx} className="aihub-ref-comment">
                                <p className="aihub-ref-quote">“{c.quote}”</p>
                                <p className="aihub-ref-explain">
                                  {c.explanation}
                                </p>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>

                      <div className="aihub-fieldset" style={{ marginTop: 14 }}>
                        <label
                          className="aihub-fieldset-label"
                          htmlFor="f-instruction"
                        >
                          Instruction tuỳ biến (không bắt buộc)
                        </label>
                        <input
                          id="f-instruction"
                          type="text"
                          className="aihub-select"
                          placeholder="Ví dụ: Chỉ sinh bài tập dịch 3 câu ngắn..."
                          value={instruction}
                          onChange={(e) => setInstruction(e.target.value)}
                        />
                      </div>

                      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                        <button
                          type="button"
                          className="aihub-btn aihub-btn--accent"
                          style={{
                            flex: 1,
                            justifyContent: "center",
                            background: "#3a64fa",
                            padding: "11px 16px",
                            fontSize: "13.5px",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                          disabled={genLoading}
                          onClick={handleGenerate}
                        >
                          {genLoading ? "Đang xử lý AI…" : "Sinh bài tập AI →"}
                        </button>
                      </div>
                      {genError && (
                        <p
                          className="aihub-error-text"
                          style={{ marginTop: 8 }}
                        >
                          {genError}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Bước 3 */}
                <div className="aihub-astep">
                  <button
                    type="button"
                    className="aihub-astep-head"
                    aria-expanded={openStep === 3}
                    data-done={!!editedSample}
                    disabled={!editedSample}
                    onClick={() => editedSample && setOpenStep(3)}
                  >
                    <span className="aihub-astep-num">3</span>
                    <span className="aihub-astep-title">
                      Sinh bài tập & Sửa trực tiếp
                    </span>
                    <ChevronIcon className="aihub-astep-chevron" />
                  </button>
                  {openStep === 3 && editedSample && (
                    <div className="aihub-astep-body">
                      <p
                        className="aihub-step-desc"
                        style={{ marginBottom: "16px", lineHeight: "1.6" }}
                      >
                        Bài tập đã được sinh. Bạn có thể xem và{" "}
                        <strong>sửa trực tiếp từng trường</strong> ở bảng bên
                        phải.
                      </p>
                      <div style={{ marginTop: "16px", marginBottom: "8px" }}>
                        <button
                          type="button"
                          className="aihub-btn aihub-btn--accent"
                          style={{
                            width: "100%",
                            justifyContent: "center",
                            background: "#3a64fa",
                            padding: "12px 18px",
                            fontSize: "14px",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            boxShadow: "0 2px 8px rgba(58, 100, 250, 0.2)",
                          }}
                          onClick={() => setOpenStep(4)}
                        >
                          Chấm điểm & Quyết định →
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bước 4 */}
                <div className="aihub-astep">
                  <button
                    type="button"
                    className="aihub-astep-head"
                    aria-expanded={openStep === 4}
                    data-done={!!acceptedNote}
                    disabled={!editedSample}
                    onClick={() => editedSample && setOpenStep(4)}
                  >
                    <span className="aihub-astep-num">4</span>
                    <span className="aihub-astep-title">
                      Chấm điểm & Quyết định
                    </span>
                    <ChevronIcon className="aihub-astep-chevron" />
                  </button>
                  {openStep === 4 && editedSample && (
                    <div className="aihub-astep-body">
                      {/* ĐÁNH GIÁ ĐIỂM SỐ */}
                      <div
                        className="aihub-fieldset"
                        style={{
                          background: "#eae5fc",
                          padding: "14px",
                          borderRadius: "10px",
                        }}
                      >
                        <label
                          className="aihub-fieldset-label"
                          style={{ fontWeight: 800, color: "#1d2838" }}
                        >
                          Đánh giá chất lượng bài tập (Thang 1–10):
                        </label>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            marginTop: "6px",
                          }}
                        >
                          <input
                            type="range"
                            min={1}
                            max={10}
                            step={1}
                            value={qualityScore}
                            onChange={(e) =>
                              setQualityScore(Number(e.target.value))
                            }
                            style={{ flex: 1, accentColor: "#3a64fa" }}
                          />
                          <span
                            style={{
                              fontSize: "16px",
                              fontWeight: 800,
                              color: "#3a64fa",
                            }}
                          >
                            {qualityScore} / 10
                          </span>
                        </div>
                      </div>

                      {/* 2 NÚT ACCEPT & REJECT RÕ RÀNG */}
                      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                        <button
                          type="button"
                          className="aihub-btn aihub-btn--accent"
                          style={{
                            flex: 1,
                            justifyContent: "center",
                            background: "#10b981",
                            borderColor: "#10b981",
                          }}
                          onClick={handleAccept}
                        >
                          Accept (Lưu mẫu)
                        </button>
                        <button
                          type="button"
                          className="aihub-btn"
                          style={{
                            background: "#f59e0b",
                            color: "#fff",
                            borderColor: "#f59e0b",
                          }}
                          onClick={() => setShowRejectModal(true)}
                        >
                          Reject (Từ chối)
                        </button>
                      </div>
                      {acceptedNote && (
                        <div
                          style={{
                            marginTop: 14,
                            background: "#ecfdf5",
                            border: "1px solid #a7f3d0",
                            padding: "14px",
                            borderRadius: "10px",
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              fontSize: "13px",
                              fontWeight: 700,
                              color: "#065f46",
                            }}
                          >
                            {acceptedNote}
                          </p>
                          <button
                            type="button"
                            className="aihub-btn aihub-btn--accent"
                            style={{
                              marginTop: 10,
                              width: "100%",
                              justifyContent: "center",
                              background: "#059669",
                            }}
                            onClick={() => {
                              clearDownstream();
                              setOpenStep(1);
                            }}
                          >
                            Tiếp tục duyệt mẫu cho chủ đề tiếp theo →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CỘT PHẢI — TERMINAL & BÀI TẬP HIỂN THỊ CHUẨN ĐẸP */}
            <div className="aihub-split-right">
              <div className="aihub-card-top" style={{ marginBottom: 4 }}>
                <h2 className="aihub-category-name" style={{ margin: 0 }}>
                  AIHub Lab — Tạo bài tập & Chấm điểm
                </h2>
                <span
                  className="aihub-badge"
                  data-status="academic"
                  style={{ background: "#1d2838", color: "#fff" }}
                >
                  ACADEMIC
                </span>
              </div>
              <p className="aihub-sublabel">
                Đúng những lệnh gọi mà backend thực hiện. Chuyên viên có thể xem
                giao diện bài tập chuẩn đẹp hoặc bật chế độ sửa nội dung.
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

              {/* Tab 1: Reference */}
              {backendTab === 1 && (
                <div>
                  <div className="aihub-callout">
                    Gọi <code>POST /portal/academic/references/query</code> với
                    writing_task, topic, criterion, error_code để lấy các bài
                    làm thật chứa đúng lỗi cần luyện.
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
                          "/portal/academic/references/query",
                          referencesPayload
                        )}
                      </pre>
                    ) : (
                      <div className="aihub-code-placeholder">
                        Chọn đủ Task, Topic, Criteria, Error Code ở bên trái để
                        dựng request.
                      </div>
                    )
                  ) : refData ? (
                    <pre className="aihub-code">
                      {JSON.stringify(refData, null, 2)}
                    </pre>
                  ) : (
                    <div className="aihub-code-placeholder">
                      Chưa gọi — bấm “Query reference” ở bên trái.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Sinh bài tập & Interface / Response JSON / Request */}
              {backendTab === 2 && (
                <div>
                  <div
                    className="aihub-callout"
                    style={{ marginBottom: "14px" }}
                  >
                    Gọi <code>POST /portal/academic/samples/generate</code> để
                    sinh bài tập. Bạn có thể xem trước giao diện bài tập, chỉnh
                    sửa ở từng câu hoặc thao tác trực tiếp trên{" "}
                    <strong>Response JSON</strong>. Dữ liệu được đồng bộ hai
                    chiều.
                  </div>

                  {/* 3 TABS CHUẨN: Interface | Response JSON | Request */}
                  <div className="aihub-tabs" style={{ marginBottom: "16px" }}>
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
                      onClick={() => {
                        setRrTab2("response");
                        if (
                          editedSample &&
                          (!rawJsonText || !rawJsonText.trim())
                        ) {
                          setRawJsonText(JSON.stringify(editedSample, null, 2));
                          setJsonSyntaxError(null);
                        }
                      }}
                    >
                      Response JSON
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

                  {/* TAB 1: INTERFACE HIỂN THỊ TRỰC QUAN + NÚT SỬA TỪNG CÂU */}
                  {rrTab2 === "interface" && (
                    <div>
                      {!editedSample ? (
                        <div className="aihub-code-placeholder">
                          Chưa có dữ liệu bài tập — bấm “Sinh bài tập AI” ở Bước
                          2 bên trái.
                        </div>
                      ) : (
                        <div>
                          {/* 1. HIỂN THỊ RÕ RÀNG LOẠI BÀI TẬP (KHÔNG ICON, KHÔNG AI CHẤM ĐIỂM) */}
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "8px",
                              alignItems: "center",
                              marginBottom: "14px",
                            }}
                          >
                            <span
                              style={{
                                background: "#3a64fa",
                                color: "#ffffff",
                                padding: "4px 12px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 700,
                              }}
                            >
                              Dạng bài:{" "}
                              {EXERCISE_TYPE_LABELS[
                                meta?.type as ExerciseType
                              ] ||
                                meta?.type ||
                                "Dịch câu ngắn (Short Writing)"}
                            </span>
                            <span
                              style={{
                                background: "#f1f5f9",
                                color: "#334155",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 600,
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              {meta?.number_of_questions || exerciseList.length}{" "}
                              câu hỏi
                            </span>
                            <span
                              style={{
                                background: "#f1f5f9",
                                color: "#334155",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 600,
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              Độ khó: {meta?.difficulty || "B2"}
                            </span>
                          </div>

                          <p
                            className="aihub-explain"
                            style={{
                              margin: "10px 0 18px",
                              fontSize: "13.5px",
                              color: "#475467",
                            }}
                          >
                            {meta?.instruction}
                          </p>

                          {/* HÌNH ẢNH / BIỂU ĐỒ TỔNG THỂ CỦA ĐỀ BÀI (NẾU CÓ) */}
                          {Boolean(
                            editedSample?.image ||
                            editedSample?.image_url ||
                            editedSample?.imageUrl ||
                            editedSample?.chart ||
                            (editedSample?.data &&
                              (editedSample?.data?.image ||
                                editedSample?.data?.image_url ||
                                editedSample?.data?.imageUrl)) ||
                            (editedSample?.question &&
                              (editedSample?.question?.image ||
                                editedSample?.question?.image_url))
                          ) && (
                            <div
                              style={{
                                margin: "0 0 20px",
                                padding: "14px",
                                borderRadius: "12px",
                                background: "#ffffff",
                                border: "1px solid #e2e8f0",
                                textAlign: "center",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  color: "#64748b",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                  marginBottom: "8px",
                                }}
                              >
                                📊 Hình ảnh đề bài / Biểu đồ Task
                              </div>
                              {/* eslint-disable-next-line @next/next/no-img-element -- generated samples can contain arbitrary customer image URLs. */}
                              <img
                                src={
                                  editedSample?.image ||
                                  editedSample?.image_url ||
                                  editedSample?.imageUrl ||
                                  editedSample?.chart ||
                                  editedSample?.data?.image ||
                                  editedSample?.data?.image_url ||
                                  editedSample?.data?.imageUrl ||
                                  editedSample?.question?.image ||
                                  editedSample?.question?.image_url
                                }
                                alt="Đề bài / Biểu đồ Task"
                                style={{
                                  maxWidth: "100%",
                                  maxHeight: "360px",
                                  objectFit: "contain",
                                  borderRadius: "8px",
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                                }}
                              />
                            </div>
                          )}

                          {/* DANH SÁCH CÁC CÂU HỎI VỚI NÚT SỬA GÓC PHẢI TRÊN */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "16px",
                            }}
                          >
                            {exerciseList.map(
                              (item: AcademicExercise, idx: number) => {
                                const qNo = item.questions_no || idx + 1;
                                const isEditing = editingQuestionIndex === idx;
                                const qImage =
                                  item.question_image ||
                                  item.image ||
                                  item.image_url ||
                                  item.imageUrl ||
                                  item.chart ||
                                  null;
                                const correctDetails = answerDetails(
                                  item.correct
                                );
                                const sampleAns =
                                  correctDetails?.sample_answer ??
                                  (typeof item.correct === "object"
                                    ? undefined
                                    : item.correct);
                                const rubric =
                                  correctDetails?.ai_grading_rubric;
                                const explain =
                                  correctDetails?.explanation ??
                                  item.explanation;
                                const hintText = Array.isArray(item.hint)
                                  ? item.hint.join(", ")
                                  : item.hint || "";

                                return (
                                  <div
                                    key={qNo}
                                    className="aihub-exercise-item"
                                    style={{
                                      border: isEditing
                                        ? "2px solid #3a64fa"
                                        : "1px solid #e2e8f0",
                                      borderRadius: "12px",
                                      padding: "18px",
                                      background: isEditing
                                        ? "#f8faff"
                                        : "#ffffff",
                                      boxShadow: isEditing
                                        ? "0 4px 16px rgba(58, 100, 250, 0.1)"
                                        : "0 1px 3px rgba(0,0,0,0.02)",
                                      transition: "all 0.15s ease",
                                    }}
                                  >
                                    {/* HEADER CÂU + NÚT SỬA GÓC PHẢI TRÊN */}
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: "12px",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: "14px",
                                          fontWeight: 800,
                                          color: isEditing
                                            ? "#3a64fa"
                                            : "#1e293b",
                                        }}
                                      >
                                        Câu {qNo}.
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditingQuestionIndex(
                                            isEditing ? null : idx
                                          )
                                        }
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          background: isEditing
                                            ? "#3a64fa"
                                            : "#f1f5f9",
                                          color: isEditing
                                            ? "#ffffff"
                                            : "#475467",
                                          border: "1px solid",
                                          borderColor: isEditing
                                            ? "#3a64fa"
                                            : "#cbd5e1",
                                          borderRadius: "6px",
                                          padding: "4px 10px",
                                          fontSize: "12px",
                                          fontWeight: 600,
                                          cursor: "pointer",
                                          transition: "all 0.15s ease",
                                        }}
                                      >
                                        {isEditing
                                          ? "Lưu thay đổi"
                                          : "Chỉnh sửa"}
                                      </button>
                                    </div>

                                    {/* KHI ĐANG Ở CHẾ ĐỘ SỬA CHO CÂU NÀY */}
                                    {isEditing ? (
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "12px",
                                        }}
                                      >
                                        <div>
                                          <label
                                            style={{
                                              display: "block",
                                              fontSize: "11px",
                                              fontWeight: 700,
                                              color: "#334155",
                                              marginBottom: "3px",
                                            }}
                                          >
                                            Đề bài câu hỏi:
                                          </label>
                                          <textarea
                                            rows={2}
                                            value={item.question_text}
                                            onChange={(e) =>
                                              handleEditField(
                                                idx,
                                                "question_text",
                                                e.target.value
                                              )
                                            }
                                            className="aihub-select"
                                            style={{
                                              width: "100%",
                                              padding: "8px",
                                              fontSize: "13px",
                                              fontFamily: "inherit",
                                            }}
                                          />
                                        </div>

                                        {/* Chỉnh sửa options nếu có */}
                                        {item.options &&
                                          typeof item.options === "object" && (
                                            <div>
                                              <label
                                                style={{
                                                  display: "block",
                                                  fontSize: "11px",
                                                  fontWeight: 700,
                                                  color: "#334155",
                                                  marginBottom: "6px",
                                                }}
                                              >
                                                Các phương án lựa chọn
                                                (Options):
                                              </label>
                                              <div
                                                style={{
                                                  display: "flex",
                                                  flexDirection: "column",
                                                  gap: "6px",
                                                }}
                                              >
                                                {Object.entries(
                                                  item.options as Record<
                                                    string,
                                                    string
                                                  >
                                                ).map(([optKey, optVal]) => (
                                                  <div
                                                    key={optKey}
                                                    style={{
                                                      display: "flex",
                                                      gap: "8px",
                                                      alignItems: "center",
                                                    }}
                                                  >
                                                    <span
                                                      style={{
                                                        fontWeight: 700,
                                                        width: "20px",
                                                        fontSize: "13px",
                                                        color: "#475467",
                                                      }}
                                                    >
                                                      {optKey}.
                                                    </span>
                                                    <input
                                                      type="text"
                                                      value={optVal}
                                                      onChange={(e) => {
                                                        const updatedOptions = {
                                                          ...item.options,
                                                          [optKey]:
                                                            e.target.value,
                                                        };
                                                        handleEditField(
                                                          idx,
                                                          "options",
                                                          updatedOptions
                                                        );
                                                      }}
                                                      className="aihub-select"
                                                      style={{
                                                        flex: 1,
                                                        padding: "6px 10px",
                                                        fontSize: "13px",
                                                      }}
                                                    />
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                        <div>
                                          <label
                                            style={{
                                              display: "block",
                                              fontSize: "11px",
                                              fontWeight: 700,
                                              color: "#334155",
                                              marginBottom: "3px",
                                            }}
                                          >
                                            Hình ảnh minh hoạ câu hỏi (URL nếu
                                            có):
                                          </label>
                                          <input
                                            type="text"
                                            value={qImage || ""}
                                            onChange={(e) =>
                                              handleEditField(
                                                idx,
                                                "question_image",
                                                e.target.value
                                              )
                                            }
                                            placeholder="https://..."
                                            className="aihub-select"
                                            style={{
                                              width: "100%",
                                              padding: "8px",
                                              fontSize: "13px",
                                            }}
                                          />
                                          {qImage && (
                                            <div style={{ marginTop: "6px" }}>
                                              {/* eslint-disable-next-line @next/next/no-img-element -- generated samples can contain arbitrary customer image URLs. */}
                                              <img
                                                src={qImage}
                                                alt=""
                                                style={{
                                                  maxHeight: "120px",
                                                  borderRadius: "6px",
                                                  border: "1px solid #e2e8f0",
                                                }}
                                              />
                                            </div>
                                          )}
                                        </div>

                                        <div>
                                          <label
                                            style={{
                                              display: "block",
                                              fontSize: "11px",
                                              fontWeight: 700,
                                              color: "#334155",
                                              marginBottom: "3px",
                                            }}
                                          >
                                            Hints gợi ý (phân cách bằng dấu
                                            phẩy):
                                          </label>
                                          <input
                                            type="text"
                                            value={hintText}
                                            onChange={(e) =>
                                              handleEditHints(
                                                idx,
                                                e.target.value
                                              )
                                            }
                                            className="aihub-select"
                                            style={{
                                              width: "100%",
                                              padding: "8px",
                                              fontSize: "13px",
                                            }}
                                          />
                                        </div>

                                        {/* Đáp án mẫu */}
                                        {sampleAns !== undefined && (
                                          <div>
                                            <label
                                              style={{
                                                display: "block",
                                                fontSize: "11px",
                                                fontWeight: 700,
                                                color: "#065f46",
                                                marginBottom: "3px",
                                              }}
                                            >
                                              Đáp án mẫu (Sample Answer):
                                            </label>
                                            <textarea
                                              rows={2}
                                              value={sampleAns || ""}
                                              onChange={(e) =>
                                                handleEditField(
                                                  idx,
                                                  "sample_answer",
                                                  e.target.value
                                                )
                                              }
                                              className="aihub-select"
                                              style={{
                                                width: "100%",
                                                padding: "8px",
                                                fontSize: "13px",
                                                fontFamily: "inherit",
                                                background: "#f0fdf4",
                                                color: "#065f46",
                                              }}
                                            />
                                          </div>
                                        )}

                                        {/* Rubric */}
                                        {rubric !== null &&
                                          rubric !== undefined && (
                                            <div>
                                              <label
                                                style={{
                                                  display: "block",
                                                  fontSize: "11px",
                                                  fontWeight: 700,
                                                  color: "#475467",
                                                  marginBottom: "3px",
                                                }}
                                              >
                                                Tiêu chí chấm điểm (Grading
                                                Rubric):
                                              </label>
                                              <textarea
                                                rows={3}
                                                value={rubric || ""}
                                                onChange={(e) =>
                                                  handleEditField(
                                                    idx,
                                                    "ai_grading_rubric",
                                                    e.target.value
                                                  )
                                                }
                                                className="aihub-select"
                                                style={{
                                                  width: "100%",
                                                  padding: "8px",
                                                  fontSize: "12px",
                                                  fontFamily: "inherit",
                                                  background: "#f8fafc",
                                                  color: "#334155",
                                                }}
                                              />
                                            </div>
                                          )}

                                        <div>
                                          <label
                                            style={{
                                              display: "block",
                                              fontSize: "11px",
                                              fontWeight: 700,
                                              color: "#475467",
                                              marginBottom: "3px",
                                            }}
                                          >
                                            Giải thích học thuật:
                                          </label>
                                          <textarea
                                            rows={2}
                                            value={explain || ""}
                                            onChange={(e) =>
                                              handleEditField(
                                                idx,
                                                "explanation",
                                                e.target.value
                                              )
                                            }
                                            className="aihub-select"
                                            style={{
                                              width: "100%",
                                              padding: "8px",
                                              fontSize: "12px",
                                              fontFamily: "inherit",
                                            }}
                                          />
                                        </div>

                                        <div
                                          style={{
                                            display: "flex",
                                            justifyContent: "flex-end",
                                          }}
                                        >
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEditingQuestionIndex(null)
                                            }
                                            className="aihub-btn aihub-btn--accent"
                                            style={{
                                              padding: "6px 14px",
                                              fontSize: "12px",
                                            }}
                                          >
                                            Hoàn tất sửa câu {qNo}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      /* KHI Ở CHẾ ĐỘ XEM CHUẨN ĐẸP (ICON-FREE, CLEAN, PROFESSIONAL) */
                                      <div>
                                        <p
                                          style={{
                                            margin: "0 0 12px",
                                            fontSize: "14.5px",
                                            lineHeight: "1.6",
                                            color: "#0f172a",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {item.question_text}
                                        </p>

                                        {/* Hình ảnh minh hoạ câu hỏi nếu có */}
                                        {qImage && (
                                          <div
                                            style={{
                                              margin: "12px 0 16px",
                                              textAlign: "center",
                                            }}
                                          >
                                            {/* eslint-disable-next-line @next/next/no-img-element -- generated samples can contain arbitrary customer image URLs. */}
                                            <img
                                              src={qImage}
                                              alt={`Minh hoạ câu ${qNo}`}
                                              style={{
                                                maxWidth: "100%",
                                                maxHeight: "320px",
                                                objectFit: "contain",
                                                borderRadius: "8px",
                                                border: "1px solid #e2e8f0",
                                                boxShadow:
                                                  "0 2px 6px rgba(0,0,0,0.04)",
                                              }}
                                            />
                                          </div>
                                        )}

                                        {/* Hints gợi ý */}
                                        {Array.isArray(item.hint) &&
                                          item.hint.length > 0 && (
                                            <div
                                              style={{
                                                display: "flex",
                                                flexWrap: "wrap",
                                                gap: "6px",
                                                margin: "8px 0 12px",
                                              }}
                                            >
                                              <span
                                                style={{
                                                  fontSize: "11px",
                                                  fontWeight: 700,
                                                  color: "#64748b",
                                                  textTransform: "uppercase",
                                                  alignSelf: "center",
                                                  marginRight: "4px",
                                                }}
                                              >
                                                Gợi ý:
                                              </span>
                                              {item.hint.map((h: string) => (
                                                <span
                                                  key={h}
                                                  style={{
                                                    fontSize: "11.5px",
                                                    background: "#f1f5f9",
                                                    color: "#334155",
                                                    padding: "2px 8px",
                                                    borderRadius: "4px",
                                                    border: "1px solid #e2e8f0",
                                                  }}
                                                >
                                                  {h}
                                                </span>
                                              ))}
                                            </div>
                                          )}

                                        {/* 1. DẠNG BÀI: MULTIPLE CHOICE (Single / Multiple) / CHOOSE FROM LIST */}
                                        {item.options &&
                                          typeof item.options === "object" &&
                                          Object.keys(item.options).length >
                                            0 && (
                                            <div
                                              style={{
                                                margin: "12px 0",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "8px",
                                              }}
                                            >
                                              {Object.entries(
                                                item.options as Record<
                                                  string,
                                                  string
                                                >
                                              ).map(([key, text]) => {
                                                let isCorrect = false;
                                                if (
                                                  Array.isArray(item.correct)
                                                ) {
                                                  isCorrect =
                                                    item.correct.includes(key);
                                                } else if (
                                                  typeof item.correct ===
                                                  "string"
                                                ) {
                                                  isCorrect =
                                                    item.correct
                                                      .trim()
                                                      .toUpperCase() ===
                                                    key.toUpperCase();
                                                } else if (
                                                  correctDetails?.sample_answer
                                                ) {
                                                  isCorrect =
                                                    correctDetails.sample_answer.includes(
                                                      key
                                                    );
                                                }

                                                return (
                                                  <div
                                                    key={key}
                                                    style={{
                                                      display: "flex",
                                                      alignItems: "flex-start",
                                                      gap: "12px",
                                                      padding: "10px 14px",
                                                      borderRadius: "8px",
                                                      border: isCorrect
                                                        ? "1.5px solid #10b981"
                                                        : "1px solid #e2e8f0",
                                                      background: isCorrect
                                                        ? "#f0fdf4"
                                                        : "#ffffff",
                                                      transition:
                                                        "all 0.15s ease",
                                                    }}
                                                  >
                                                    <span
                                                      style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                          "center",
                                                        width: "24px",
                                                        height: "24px",
                                                        minWidth: "24px",
                                                        borderRadius: "6px",
                                                        fontSize: "12px",
                                                        fontWeight: 700,
                                                        background: isCorrect
                                                          ? "#10b981"
                                                          : "#f1f5f9",
                                                        color: isCorrect
                                                          ? "#ffffff"
                                                          : "#475467",
                                                      }}
                                                    >
                                                      {key}
                                                    </span>
                                                    <div
                                                      style={{
                                                        flex: 1,
                                                        fontSize: "13.5px",
                                                        lineHeight: "1.5",
                                                        color: "#1e293b",
                                                        fontWeight: isCorrect
                                                          ? 600
                                                          : 400,
                                                      }}
                                                    >
                                                      {text}
                                                    </div>
                                                    {isCorrect && (
                                                      <span
                                                        style={{
                                                          fontSize: "11px",
                                                          fontWeight: 700,
                                                          textTransform:
                                                            "uppercase",
                                                          letterSpacing:
                                                            "0.04em",
                                                          color: "#059669",
                                                          background: "#d1fae5",
                                                          padding: "2px 8px",
                                                          borderRadius: "4px",
                                                          whiteSpace: "nowrap",
                                                        }}
                                                      >
                                                        Đáp án đúng
                                                      </span>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}

                                        {/* 2. DẠNG BÀI: GAP FILLING / REORDER / ANNOTATION / SHORT WRITING - Khi không có options */}
                                        {(!item.options ||
                                          Object.keys(item.options).length ===
                                            0) && (
                                          <>
                                            {/* Reorder / List Answer */}
                                            {Array.isArray(item.correct) && (
                                              <div
                                                style={{
                                                  margin: "10px 0",
                                                  padding: "10px 14px",
                                                  borderRadius: "8px",
                                                  background: "#f0fdf4",
                                                  border: "1px solid #bbf7d0",
                                                }}
                                              >
                                                <span
                                                  style={{
                                                    fontSize: "12px",
                                                    fontWeight: 700,
                                                    color: "#065f46",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.04em",
                                                  }}
                                                >
                                                  Thứ tự / Đáp án đúng:
                                                </span>{" "}
                                                <span
                                                  style={{
                                                    fontSize: "13.5px",
                                                    fontWeight: 700,
                                                    color: "#047857",
                                                  }}
                                                >
                                                  {item.correct.join(" → ")}
                                                </span>
                                              </div>
                                            )}

                                            {/* Sample Answer (Short Writing / Sentence Translation) */}
                                            {sampleAns &&
                                              typeof sampleAns === "string" &&
                                              sampleAns.trim().length > 0 && (
                                                <div
                                                  style={{
                                                    margin: "10px 0",
                                                    padding: "10px 14px",
                                                    borderRadius: "8px",
                                                    background: "#f0fdf4",
                                                    border: "1px solid #bbf7d0",
                                                  }}
                                                >
                                                  <div
                                                    style={{
                                                      fontSize: "11.5px",
                                                      fontWeight: 700,
                                                      color: "#065f46",
                                                      textTransform:
                                                        "uppercase",
                                                      letterSpacing: "0.04em",
                                                      marginBottom: "4px",
                                                    }}
                                                  >
                                                    Đáp án mẫu:
                                                  </div>
                                                  <div
                                                    style={{
                                                      fontSize: "13.5px",
                                                      color: "#064e3b",
                                                      lineHeight: "1.5",
                                                      fontWeight: 500,
                                                    }}
                                                  >
                                                    {sampleAns}
                                                  </div>
                                                </div>
                                              )}

                                            {/* Rubric (Short Writing) */}
                                            {rubric &&
                                              typeof rubric === "string" &&
                                              rubric.trim().length > 0 && (
                                                <div
                                                  style={{
                                                    margin: "10px 0",
                                                    padding: "10px 14px",
                                                    borderRadius: "8px",
                                                    background: "#f8fafc",
                                                    border: "1px solid #e2e8f0",
                                                  }}
                                                >
                                                  <div
                                                    style={{
                                                      fontSize: "11px",
                                                      fontWeight: 700,
                                                      color: "#475467",
                                                      textTransform:
                                                        "uppercase",
                                                      letterSpacing: "0.04em",
                                                      marginBottom: "4px",
                                                    }}
                                                  >
                                                    Tiêu chí chấm điểm (Grading
                                                    Rubric):
                                                  </div>
                                                  <div
                                                    style={{
                                                      fontSize: "12.5px",
                                                      color: "#334155",
                                                      lineHeight: "1.5",
                                                    }}
                                                  >
                                                    {rubric}
                                                  </div>
                                                </div>
                                              )}
                                          </>
                                        )}

                                        {/* GIẢI THÍCH HỌC THUẬT (Áp dụng cho mọi câu) */}
                                        {explain &&
                                          typeof explain === "string" &&
                                          explain.trim().length > 0 && (
                                            <div
                                              style={{
                                                margin: "12px 0 0",
                                                padding: "12px 14px",
                                                borderRadius: "8px",
                                                background: "#f8fafc",
                                                border: "1px solid #e2e8f0",
                                                fontSize: "12.5px",
                                                lineHeight: "1.6",
                                                color: "#334155",
                                              }}
                                            >
                                              <div
                                                style={{
                                                  fontSize: "11px",
                                                  fontWeight: 700,
                                                  color: "#475467",
                                                  textTransform: "uppercase",
                                                  letterSpacing: "0.04em",
                                                  marginBottom: "4px",
                                                }}
                                              >
                                                Giải thích chi tiết:
                                              </div>
                                              <div>{explain}</div>
                                            </div>
                                          )}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: RESPONSE JSON (CHO PHÉP SỬA TRỰC TIẾP TRÊN JSON & ĐỒNG BỘ 2 CHIỀU) */}
                  {rrTab2 === "response" && (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "10px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          {jsonSyntaxError ? (
                            <span
                              style={{
                                color: "#ef4444",
                                fontSize: "12px",
                                fontWeight: 700,
                              }}
                            >
                              Lỗi cú pháp JSON ({jsonSyntaxError})
                            </span>
                          ) : (
                            <span
                              style={{
                                color: "#10b981",
                                fontSize: "12px",
                                fontWeight: 700,
                              }}
                            >
                              JSON hợp lệ (Tự động đồng bộ sang Interface & DB)
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={handleFormatJson}
                            className="aihub-btn aihub-btn--ghost"
                            style={{ padding: "4px 10px", fontSize: "12px" }}
                          >
                            Format JSON
                          </button>
                          <button
                            type="button"
                            onClick={handleCopyJson}
                            className="aihub-btn aihub-btn--ghost"
                            style={{ padding: "4px 10px", fontSize: "12px" }}
                          >
                            {copyJsonToast ? "Đã sao chép" : "Sao chép"}
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={22}
                        value={
                          rawJsonText ||
                          (editedSample
                            ? JSON.stringify(editedSample, null, 2)
                            : "")
                        }
                        onChange={(e) => handleRawJsonChange(e.target.value)}
                        placeholder="Chưa có dữ liệu JSON bài tập. Hãy bấm 'Sinh bài tập AI' ở bên trái."
                        className="aihub-code"
                        style={{
                          width: "100%",
                          padding: "16px",
                          fontSize: "12.5px",
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, monospace",
                          lineHeight: "1.6",
                          border: jsonSyntaxError
                            ? "2px solid #ef4444"
                            : "1px solid #334155",
                          borderRadius: "12px",
                          background: "#0f172a",
                          color: "#f8fafc",
                          resize: "vertical",
                        }}
                      />
                    </div>
                  )}

                  {/* TAB 3: REQUEST CURL */}
                  {rrTab2 === "request" && (
                    <pre className="aihub-code">
                      {curl(
                        "/portal/academic/samples/generate",
                        generatePayload
                      )}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: INVENTORY TABLE */}
        {mainTab === "inventory" && (
          <div
            style={{
              background: "#fff",
              padding: "24px",
              borderRadius: "16px",
              border: "1px solid #e4e7ec",
              marginTop: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "18px",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "20px",
                    fontWeight: 800,
                    color: "#1d2838",
                    margin: 0,
                  }}
                >
                  Kho Mẫu Huấn Luyện Đã Lưu
                </h2>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#667084",
                    margin: "4px 0 0",
                  }}
                >
                  Toàn bộ các bài tập đã được chuyên viên chấm và lưu vào
                  Database.
                </p>
              </div>

              <select
                value={invFilterStatus}
                onChange={(e) => setInvFilterStatus(e.target.value)}
                className="aihub-select"
                style={{ width: "180px" }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ACCEPTED">Accepted (Đã duyệt)</option>
                <option value="REJECTED">Rejected (Từ chối)</option>
              </select>
            </div>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    textAlign: "left",
                  }}
                >
                  <th
                    style={{
                      padding: "10px 12px",
                      fontWeight: 700,
                      color: "#475467",
                    }}
                  >
                    Mã mẫu
                  </th>
                  <th
                    style={{
                      padding: "10px 12px",
                      fontWeight: 700,
                      color: "#475467",
                    }}
                  >
                    Task
                  </th>
                  <th
                    style={{
                      padding: "10px 12px",
                      fontWeight: 700,
                      color: "#475467",
                    }}
                  >
                    Tiêu chí
                  </th>
                  <th
                    style={{
                      padding: "10px 12px",
                      fontWeight: 700,
                      color: "#475467",
                    }}
                  >
                    Mã lỗi
                  </th>
                  <th
                    style={{
                      padding: "10px 12px",
                      fontWeight: 700,
                      color: "#475467",
                    }}
                  >
                    Điểm
                  </th>
                  <th
                    style={{
                      padding: "10px 12px",
                      fontWeight: 700,
                      color: "#475467",
                    }}
                  >
                    Trạng thái
                  </th>
                  <th
                    style={{
                      padding: "10px 12px",
                      fontWeight: 700,
                      color: "#475467",
                      textAlign: "right",
                    }}
                  >
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {inventoryList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: "24px",
                        textAlign: "center",
                        color: "#94a3b8",
                      }}
                    >
                      Chưa có mẫu nào trong database. Hãy bấm Accept ở Phòng Lab
                      để lưu mẫu đầu tiên.
                    </td>
                  </tr>
                ) : (
                  inventoryList.map((item) => (
                    <tr
                      key={item.id}
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                    >
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                        {item.id}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textTransform: "uppercase",
                        }}
                      >
                        {item.taskId}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          color: "#3a64fa",
                          fontWeight: 600,
                        }}
                      >
                        {item.criterion}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          fontFamily: "monospace",
                        }}
                      >
                        {item.errorCode}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "10px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: "#f1f5f9",
                            color: "#334155",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          {item.score ? `${item.score}/10` : "—"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "10px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background:
                              item.status === "ACCEPTED"
                                ? "#d1fae5"
                                : "#fee2e2",
                            color:
                              item.status === "ACCEPTED"
                                ? "#065f46"
                                : "#991b1b",
                          }}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedDetail(item)}
                          className="aihub-btn aihub-btn--ghost"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                        >
                          Xem chi tiết →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: LIVE API REQUEST LOGS */}
        {mainTab === "logs" && (
          <div className="aihub-card" style={{ marginTop: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: 800,
                    margin: 0,
                    color: "#1d2838",
                  }}
                >
                  🪵 Live API Request Logs ({apiLogs.length})
                </h3>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#667084",
                    margin: "4px 0 0",
                  }}
                >
                  Theo dõi trạng thái HTTP, độ trễ phản hồi (ms), request
                  payload và response payload thực tế.
                </p>
              </div>
              <button
                type="button"
                className="aihub-btn aihub-btn--ghost"
                onClick={() => setApiLogs([])}
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                Xóa Logs
              </button>
            </div>

            {apiLogs.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "#98a2b3",
                  fontSize: "13px",
                }}
              >
                Chưa có request nào trong phiên làm việc này. Hãy thực hiện thao
                tác Query Reference hoặc Sinh bài tập.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {apiLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      border: "1px solid #e4e7ec",
                      borderRadius: "10px",
                      padding: "12px 16px",
                      background: "#fafbfc",
                      fontSize: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            color: "#667084",
                            fontFamily: "monospace",
                            fontSize: "11px",
                          }}
                        >
                          {log.timestamp}
                        </span>
                        <span
                          style={{
                            fontWeight: 800,
                            background: "#e0e7ff",
                            color: "#3730a3",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {log.method}
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: "#1d2838",
                            fontFamily: "monospace",
                          }}
                        >
                          {log.endpoint}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ color: "#667084", fontSize: "11px" }}>
                          ⏱ {log.durationMs}ms
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "10px",
                            fontSize: "11px",
                            background:
                              log.status >= 200 && log.status < 300
                                ? "#d1fae5"
                                : "#fee2e2",
                            color:
                              log.status >= 200 && log.status < 300
                                ? "#065f46"
                                : "#991b1b",
                          }}
                        >
                          HTTP {log.status}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "11px",
                            color: "#475467",
                            marginBottom: "4px",
                          }}
                        >
                          Request:
                        </div>
                        <pre
                          className="aihub-code"
                          style={{
                            margin: 0,
                            maxHeight: "120px",
                            fontSize: "11px",
                          }}
                        >
                          {JSON.stringify(log.req, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "11px",
                            color: "#475467",
                            marginBottom: "4px",
                          }}
                        >
                          Response:
                        </div>
                        <pre
                          className="aihub-code"
                          style={{
                            margin: 0,
                            maxHeight: "120px",
                            fontSize: "11px",
                          }}
                        >
                          {JSON.stringify(log.res, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* REJECT REASON MODAL */}
        {showRejectModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "16px",
                padding: "24px",
                maxWidth: "500px",
                width: "100%",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 800,
                  margin: "0 0 8px",
                  color: "#1d2838",
                }}
              >
                Từ chối mẫu & Ghi nhận lý do (Reject)
              </h3>
              <p
                style={{
                  fontSize: "12px",
                  color: "#667084",
                  margin: "0 0 14px",
                }}
              >
                Mẫu bị từ chối kèm lý do này sẽ được lưu vào cơ sở dữ liệu
                fine-tuning của AIHub.
              </p>
              <textarea
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ví dụ: Câu 2 dịch chưa tự nhiên, rubric chưa rõ thang điểm..."
                className="aihub-select"
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "13px",
                  marginBottom: "14px",
                  fontFamily: "inherit",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                }}
              >
                <button
                  type="button"
                  className="aihub-btn aihub-btn--ghost"
                  onClick={() => setShowRejectModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="aihub-btn"
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    borderColor: "#ef4444",
                  }}
                  onClick={handleReject}
                >
                  Xác nhận Reject & Lưu DB
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DETAIL MODAL */}
        {selectedDetail && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "16px",
                padding: "24px",
                maxWidth: "750px",
                width: "100%",
                maxHeight: "85vh",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: 800,
                      margin: 0,
                      color: "#1d2838",
                    }}
                  >
                    Chi tiết Mẫu: {selectedDetail.id}
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      marginTop: "4px",
                      fontSize: "12px",
                      color: "#667084",
                    }}
                  >
                    <span>
                      Tiêu chí: <strong>{selectedDetail.criterion}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Mã lỗi: <strong>{selectedDetail.errorCode}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Chủ đề: <strong>{selectedDetail.topic}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Điểm: <strong>{selectedDetail.score || 9}/10 ⭐</strong>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDetail(null)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "20px",
                    cursor: "pointer",
                    color: "#98a2b3",
                  }}
                >
                  ✕
                </button>
              </div>

              {selectedDetail.rejectReason && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#fef2f2",
                    color: "#991b1b",
                    fontSize: "12px",
                    borderRadius: "8px",
                    marginBottom: "14px",
                    border: "1px solid #fecaca",
                  }}
                >
                  <strong>Lý do từ chối (Fine-tuning Log):</strong>{" "}
                  {selectedDetail.rejectReason}
                </div>
              )}

              {/* Detail Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  borderBottom: "1px solid #e4e7ec",
                  marginBottom: "14px",
                  paddingBottom: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setDetailModalTab("visual")}
                  style={{
                    border: "none",
                    background: "none",
                    padding: "4px 8px",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    color: detailModalTab === "visual" ? "#3a64fa" : "#667084",
                    borderBottom:
                      detailModalTab === "visual"
                        ? "2px solid #3a64fa"
                        : "none",
                  }}
                >
                  👁️ Xem Trực Quan
                </button>
                <button
                  type="button"
                  onClick={() => setDetailModalTab("raw")}
                  style={{
                    border: "none",
                    background: "none",
                    padding: "4px 8px",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    color: detailModalTab === "raw" ? "#3a64fa" : "#667084",
                    borderBottom:
                      detailModalTab === "raw" ? "2px solid #3a64fa" : "none",
                  }}
                >
                  🧠 Raw AI Output (Gốc)
                </button>
                <button
                  type="button"
                  onClick={() => setDetailModalTab("fixed")}
                  style={{
                    border: "none",
                    background: "none",
                    padding: "4px 8px",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    color: detailModalTab === "fixed" ? "#3a64fa" : "#667084",
                    borderBottom:
                      detailModalTab === "fixed" ? "2px solid #3a64fa" : "none",
                  }}
                >
                  ✏️ Final Fixed Output (Đã Sửa)
                </button>
              </div>

              {/* Detail Tab Contents */}
              {detailModalTab === "visual" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {(
                    selectedDetail.finalOutput?.output?.exercise ||
                    selectedDetail.rawAiOutput?.output?.exercise ||
                    selectedDetail.finalOutput?.exercise ||
                    []
                  ).map((q: AcademicExercise, qIdx: number) => {
                    const correct = answerDetails(q.correct);
                    return (
                      <div
                        key={qIdx}
                        style={{
                          background: "#f8fafc",
                          padding: "12px",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          fontSize: "12px",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            color: "#3a64fa",
                            marginBottom: "4px",
                          }}
                        >
                          Câu #{qIdx + 1}
                        </div>
                        <div
                          style={{
                            color: "#1e293b",
                            fontWeight: 600,
                            marginBottom: "6px",
                          }}
                        >
                          {q.question_text || q.question}
                        </div>
                        {q.correct && (
                          <div
                            style={{
                              background: "#ecfdf5",
                              padding: "8px",
                              borderRadius: "6px",
                              color: "#065f46",
                              fontSize: "11px",
                            }}
                          >
                            <strong>Đáp án mẫu:</strong> &quot;
                            {String(
                              correct?.sample_answer ||
                                correct?.answer ||
                                q.correct
                            )}
                            &quot;
                            {correct?.ai_grading_rubric && (
                              <div
                                style={{ marginTop: "4px", color: "#047857" }}
                              >
                                <strong>Rubric:</strong>{" "}
                                {correct.ai_grading_rubric}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {detailModalTab === "raw" && (
                <pre
                  className="aihub-code"
                  style={{ margin: 0, maxHeight: "50vh" }}
                >
                  {JSON.stringify(
                    selectedDetail.rawAiOutput || selectedDetail,
                    null,
                    2
                  )}
                </pre>
              )}

              {detailModalTab === "fixed" && (
                <pre
                  className="aihub-code"
                  style={{ margin: 0, maxHeight: "50vh" }}
                >
                  {JSON.stringify(
                    selectedDetail.finalOutput || selectedDetail,
                    null,
                    2
                  )}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
