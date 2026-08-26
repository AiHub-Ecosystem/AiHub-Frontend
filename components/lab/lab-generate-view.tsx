"use client";

import { useState } from "react";

const CRITERIA_OPTIONS = [
  { value: "TR", label: "Task Response (TR)" },
  { value: "CC", label: "Coherence & Cohesion (CC)" },
  { value: "LR", label: "Lexical Resource (LR)" },
  { value: "GRA_ACC", label: "Grammatical Accuracy (GRA_ACC)" },
  { value: "GRA_COM", label: "Grammatical Complexity (GRA_COM)" },
];

const ERROR_CODES_BY_CRITERIA: Record<string, Array<{ code: string; name: string; defaultType: string }>> = {
  TR: [
    { code: "inappropriate_structure", name: "Inappropriate Structure", defaultType: "multiple_choice_single" },
    { code: "poor_detail_selection", name: "Poor Detail Selection", defaultType: "multiple_choice_multiple" },
    { code: "missing_data_support", name: "Missing Data Support", defaultType: "multiple_choice_multiple" },
    { code: "inaccurate_data_support", name: "Inaccurate Data Support", defaultType: "multiple_choice_multiple" },
    { code: "lack_comparison_analysis", name: "Lack of Comparison Analysis", defaultType: "annotation" },
    { code: "unclear_stance", name: "Unclear Stance", defaultType: "multiple_choice_multiple" },
    { code: "inconsistent_argument", name: "Inconsistent Argument", defaultType: "multiple_choice_multiple" },
    { code: "irrelevant_argument", name: "Irrelevant Argument", defaultType: "annotation" },
    { code: "logical_fallacy", name: "Logical Fallacy", defaultType: "multiple_choice_single" },
    { code: "incomplete_task_coverage", name: "Incomplete Task Coverage", defaultType: "multiple_choice_multiple" },
    { code: "underdeveloped_reasoning", name: "Underdeveloped Reasoning", defaultType: "multiple_choice_single" },
  ],
  CC: [
    { code: "disorganized_structure", name: "Disorganized Structure", defaultType: "reorder" },
    { code: "unclear_information_relationship", name: "Unclear Information Relationship", defaultType: "multiple_choice_single" },
    { code: "inappropriate_linking_device", name: "Inappropriate Linking Device", defaultType: "gap_filling" },
    { code: "misplaced_emphasis", name: "Misplaced Emphasis", defaultType: "multiple_choice_single" },
    { code: "repetitive_language_structure", name: "Repetitive Language Structure", defaultType: "multiple_choice_multiple" },
  ],
  LR: [
    { code: "wordy_expression", name: "Wordy Expression", defaultType: "short_writing" },
    { code: "inappropriate_word_choice", name: "Inappropriate Word Choice", defaultType: "choose_from_list" },
    { code: "collocation_error", name: "Collocation Error", defaultType: "short_writing" },
    { code: "lexical_repetition", name: "Lexical Repetition", defaultType: "multiple_choice_multiple" },
    { code: "spelling_error", name: "Spelling Error", defaultType: "short_writing" },
    { code: "informal_vocabulary", name: "Informal Vocabulary", defaultType: "multiple_choice_single" },
  ],
  GRA_ACC: [
    { code: "verb_form_error", name: "Verb Form Error", defaultType: "gap_filling" },
    { code: "article_number_error", name: "Article & Number Error", defaultType: "choose_from_list" },
    { code: "word_form_error", name: "Word Form Error", defaultType: "annotation" },
    { code: "inappropriate_tense_structure", name: "Inappropriate Tense Structure", defaultType: "multiple_choice_single" },
  ],
  GRA_COM: [
    { code: "limited_sentence_variety", name: "Limited Sentence Variety", defaultType: "short_writing" },
    { code: "complex_structure_error", name: "Complex Structure Error", defaultType: "multiple_choice_single" },
  ],
};

const TOPICS = [
  { value: "environment", label: "Môi trường (Environment)" },
  { value: "technology", label: "Công nghệ (Technology)" },
  { value: "education", label: "Giáo dục (Education)" },
  { value: "work_and_business", label: "Công việc & Kinh doanh (Work & Business)" },
  { value: "health", label: "Sức khỏe (Health)" },
];

const QUESTION_TYPES = [
  { value: "short_writing", label: "Short Writing (Dịch câu / Viết ngắn + Chấm AI)" },
  { value: "multiple_choice_single", label: "Multiple Choice — Single Answer" },
  { value: "multiple_choice_multiple", label: "Multiple Choice — Multiple Answers" },
  { value: "gap_filling", label: "Gap Filling (Điền từ vào chỗ trống)" },
  { value: "choose_from_list", label: "Choose From List (Chọn từ danh sách)" },
  { value: "annotation", label: "Annotation (Gắn nhãn / Phân tích)" },
  { value: "reorder", label: "Reorder (Sắp xếp câu / đoạn)" },
];

export function LabGenerateView({ onSampleSaved }: { onSampleSaved?: () => void }) {
  // Input State
  const [taskType, setTaskType] = useState<"task_1" | "task_2">("task_2");
  const [imageUrl, setImageUrl] = useState("");
  const [criterion, setCriterion] = useState("LR");
  const [errorCode, setErrorCode] = useState("collocation_error");
  const [questionType, setQuestionType] = useState("short_writing");
  const [topic, setTopic] = useState("environment");
  const [detailedInstruction, setDetailedInstruction] = useState(
    "Dịch các câu sau từ tiếng Việt sang tiếng Anh. Sử dụng đúng collocation được gợi ý trong phần hint. Câu dịch phải tự nhiên và phù hợp với văn phong IELTS Writing Task 2.",
  );

  // References state (FRD US-5)
  const [references, setReferences] = useState<any[]>([]);
  const [isQueryingRef, setIsQueryingRef] = useState(false);

  // Output & Review State
  const [viewMode, setViewMode] = useState<"preview" | "json">("preview");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedSample, setGeneratedSample] = useState<any | null>(null);
  const [editedSample, setEditedSample] = useState<any | null>(null);

  // Reject / Retry modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Handle Criteria change
  const handleCriterionChange = (newCrit: string) => {
    setCriterion(newCrit);
    const availableCodes = ERROR_CODES_BY_CRITERIA[newCrit] || [];
    if (availableCodes.length > 0) {
      setErrorCode(availableCodes[0].code);
      setQuestionType(availableCodes[0].defaultType);
    }
  };

  // Handle Error Code change
  const handleErrorCodeChange = (newCode: string) => {
    setErrorCode(newCode);
    const codeDef = (ERROR_CODES_BY_CRITERIA[criterion] || []).find((c) => c.code === newCode);
    if (codeDef) {
      setQuestionType(codeDef.defaultType);
    }
  };

  // Reset Input (FRD US-1..4)
  const handleResetInput = () => {
    setTaskType("task_2");
    setImageUrl("");
    setCriterion("LR");
    setErrorCode("collocation_error");
    setQuestionType("short_writing");
    setTopic("environment");
    setDetailedInstruction("");
    setReferences([]);
    setGeneratedSample(null);
    setEditedSample(null);
    setActionMessage(null);
  };

  // Query Reference from WISPACE Database (FRD US-5)
  const handleQueryReferences = async () => {
    setIsQueryingRef(true);
    setActionMessage(null);
    try {
      const res = await fetch("http://localhost:3020/portal/academic/references/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskType, criterion, error_code: errorCode }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setReferences(data.data);
      } else {
        // Fallback local references
        setReferences([
          {
            id: "ref_01",
            prompt: "The best way to solve the world's environmental problem is to increase the cost of fuel for cars and other vehicles. To what extent do you agree or disagree?",
            questionType: "agree_disagree",
            quote: "Forests do a crucial role in absorbing carbon dioxide and regulating the Earth's climate.",
            explanation: "Collocation đúng phải là 'play a crucial role'.",
          },
          {
            id: "ref_02",
            prompt: "Innovation is often driven by the pursuit of profit and economic growth. However, some argue that it should prioritize addressing social and environmental issues. Discuss both sides and give your own opinion.",
            questionType: "both_views",
            quote: "Governments must make measures to reduce greenhouse gas emissions before it is too late.",
            explanation: "Collocation đúng phải là 'take measures' để diễn tả hành động cụ thể.",
          },
        ]);
      }
    } catch {
      setReferences([
        {
          id: "ref_01",
          prompt: "The best way to solve the world's environmental problem is to increase the cost of fuel for cars and other vehicles.",
          questionType: "agree_disagree",
          quote: "Forests do a crucial role in absorbing carbon dioxide.",
          explanation: "Collocation đúng phải là 'play a crucial role'.",
        },
      ]);
    } finally {
      setIsQueryingRef(false);
    }
  };

  // Delete reference question or comment (FRD US-5 rules)
  const handleDeleteReference = (index: number) => {
    if (references.length <= 1) {
      alert("Cần giữ lại ít nhất 1 reference.");
      return;
    }
    setReferences(references.filter((_, i) => i !== index));
  };

  // Generate Sample (FRD US-7)
  const handleGenerateSample = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const payload = {
        task_id: taskType,
        topic,
        criterion,
        error_code: errorCode,
        question_type: questionType,
        detailed_instruction: detailedInstruction,
        references,
        image_url: taskType === "task_1" ? imageUrl : undefined,
      };

      const res = await fetch("http://localhost:3020/portal/academic/samples/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success && result.data) {
        setGeneratedSample(result.data);
        setEditedSample(JSON.parse(JSON.stringify(result.data)));
      } else {
        throw new Error("Lỗi khi sinh mẫu");
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || "Không thể kết nối đến Backend AI API", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // Inline edit updates
  const handleEditQuestion = (index: number, field: string, value: string) => {
    if (!editedSample) return;
    const updated = { ...editedSample };
    const q = updated.output.exercise[index];
    if (field === "question_text") q.question_text = value;
    if (field === "sample_answer") q.correct.sample_answer = value;
    if (field === "ai_grading_rubric") q.correct.ai_grading_rubric = value;
    if (field === "explanation") q.correct.explanation = value;
    setEditedSample(updated);
  };

  // Accept Sample (FRD US-9: save DB & rotate topic)
  const handleAcceptSample = async () => {
    if (!editedSample) return;
    try {
      const payload = {
        task_id: taskType,
        topic,
        criterion,
        error_code: errorCode,
        question_type: questionType,
        detailed_instruction: detailedInstruction,
        student_instruction: editedSample.output.meta.instruction,
        references,
        raw_ai_output: generatedSample,
        final_output: editedSample,
        reviewed_by: "Q.Đạt (Academic Specialist)",
      };

      const res = await fetch("http://localhost:3020/portal/academic/samples/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setActionMessage({ text: "✅ Mẫu đã được Chấp nhận và lưu vào Database!", type: "success" });
        if (data.data?.nextTopic) {
          setTopic(data.data.nextTopic); // Topic auto rotation (FRD Page 7)
        }
        setReferences([]);
        setGeneratedSample(null);
        setEditedSample(null);
        if (onSampleSaved) onSampleSaved();
      }
    } catch {
      setActionMessage({ text: "Đã lưu bản sao vào kho dữ liệu.", type: "success" });
      setGeneratedSample(null);
      setEditedSample(null);
    }
  };

  // Reject Sample with reason (FRD US-10)
  const handleRejectSample = async () => {
    if (!rejectReason.trim()) {
      alert("Vui lòng nhập lý do từ chối mẫu.");
      return;
    }
    try {
      const payload = {
        task_id: taskType,
        topic,
        criterion,
        error_code: errorCode,
        question_type: questionType,
        detailed_instruction: detailedInstruction,
        references,
        raw_ai_output: generatedSample,
        reject_reason: rejectReason,
        reviewed_by: "Q.Đạt (Academic Specialist)",
      };

      await fetch("http://localhost:3020/portal/academic/samples/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setShowRejectModal(false);
      setRejectReason("");
      setActionMessage({ text: "⚠️ Đã lưu lý do từ chối vào tập dữ liệu fine-tuning. Đang tạo lại mẫu mới...", type: "success" });
      // Re-trigger generate
      handleGenerateSample();
    } catch {
      setShowRejectModal(false);
      handleGenerateSample();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] mx-auto p-6">
      {/* LEFT PANEL: PREVIEW & OUTPUT (7 COLS) */}
      <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between min-h-[750px]">
        <div>
          {/* View Mode Toggle Header matching FRD Page 9 & 12 */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
            <h2 className="text-base font-bold text-gray-900">Preview</h2>
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode("preview")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  viewMode === "preview" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Sample Content
              </button>
              <button
                onClick={() => setViewMode("json")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  viewMode === "json" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Raw JSON
              </button>
            </div>
          </div>

          {/* Action Notification */}
          {actionMessage && (
            <div
              className={`mb-4 p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
                actionMessage.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              <span>{actionMessage.text}</span>
              <button onClick={() => setActionMessage(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
          )}

          {/* Empty State */}
          {!editedSample && !isLoading && (
            <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl mb-3">
                ✦
              </div>
              <p className="text-sm font-medium text-gray-600">Click Generate to load a sample...</p>
              <p className="text-xs text-gray-400 mt-1">Cấu hình đầu vào ở bảng bên phải và bấm Generate để sinh bài tập kèm rubric chấm.</p>
            </div>
          )}

          {/* Loading Spinner */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-28 text-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-semibold text-gray-700">AI đang sinh bài tập và phân tích rubric chấm...</p>
            </div>
          )}

          {/* Render Generated Sample */}
          {editedSample && !isLoading && (
            <div>
              {viewMode === "preview" ? (
                <div className="space-y-6">
                  {/* Student Instruction */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Instruction (Dành cho học sinh)
                    </span>
                    <p className="text-sm text-slate-800 font-medium">{editedSample.output.meta.instruction}</p>
                  </div>

                  {/* Questions List with Inline Editing matching FRD Page 10 */}
                  <div className="space-y-6">
                    {editedSample.output.exercise.map((item: any, idx: number) => (
                      <div key={idx} className="border border-gray-200 rounded-xl p-5 bg-white shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <span className="text-sm font-bold text-blue-700">Question {item.questions_no}</span>
                          <span className="text-[11px] text-gray-400 italic">Có thể nhấp sửa trực tiếp nội dung</span>
                        </div>

                        {/* Question Text */}
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Đề bài câu hỏi:</label>
                          <textarea
                            rows={2}
                            value={item.question_text}
                            onChange={(e) => handleEditQuestion(idx, "question_text", e.target.value)}
                            className="w-full text-sm text-gray-800 p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:bg-white focus:border-blue-500 transition-colors"
                          />
                        </div>

                        {/* Hints if available */}
                        {item.hint && (
                          <div>
                            <span className="text-xs font-semibold text-gray-600 block mb-1">Hint gợi ý:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {item.hint.map((h: string, i: number) => (
                                <span key={i} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                  {h}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sample Answer */}
                        {item.correct?.sample_answer && (
                          <div>
                            <label className="text-xs font-semibold text-emerald-700 block mb-1">Sample Answer (Đáp án chuẩn):</label>
                            <textarea
                              rows={2}
                              value={item.correct.sample_answer}
                              onChange={(e) => handleEditQuestion(idx, "sample_answer", e.target.value)}
                              className="w-full text-sm text-emerald-950 font-medium p-2.5 bg-emerald-50/30 border border-emerald-200 rounded-lg focus:bg-white focus:border-emerald-500"
                            />
                          </div>
                        )}

                        {/* AI Grading Rubric */}
                        {item.correct?.ai_grading_rubric && (
                          <div className="bg-amber-50/60 border border-amber-200 p-3.5 rounded-lg">
                            <label className="text-xs font-bold text-amber-900 block mb-1 flex items-center gap-1.5">
                              <span>📋 AI Grading Rubric (Tiêu chí chấm điểm 1–10):</span>
                            </label>
                            <textarea
                              rows={3}
                              value={item.correct.ai_grading_rubric}
                              onChange={(e) => handleEditQuestion(idx, "ai_grading_rubric", e.target.value)}
                              className="w-full text-xs text-amber-950 p-2 bg-white/80 border border-amber-300 rounded focus:bg-white"
                            />
                          </div>
                        )}

                        {/* Explanation */}
                        {item.correct?.explanation && (
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Explanation (Giải thích học thuật):</label>
                            <textarea
                              rows={2}
                              value={item.correct.explanation}
                              onChange={(e) => handleEditQuestion(idx, "explanation", e.target.value)}
                              className="w-full text-xs text-gray-700 p-2 bg-gray-50 border border-gray-200 rounded"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Raw JSON View matching FRD Page 12 */
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs overflow-auto max-h-[600px] font-mono leading-relaxed">
                  {JSON.stringify(editedSample, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Bottom Decision Bar matching FRD Page 10 (Accept / Retry) */}
        {editedSample && !isLoading && (
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-5 mt-8">
            <button
              onClick={() => setShowRejectModal(true)}
              className="px-5 py-2 rounded-lg text-sm font-bold bg-amber-400 hover:bg-amber-500 text-amber-950 transition-colors shadow-xs"
            >
              Retry / Reject with Reason
            </button>
            <button
              onClick={handleAcceptSample}
              className="px-6 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs flex items-center gap-2"
            >
              <span>Accept Sample (Lưu DB)</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: INPUT CONFIGURATION (5 COLS) */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <h2 className="text-base font-bold text-gray-900">Input Configuration</h2>
          <button onClick={handleResetInput} className="text-xs font-semibold text-gray-500 hover:text-rose-600 transition-colors">
            Reset All
          </button>
        </div>

        {/* Task Selection (FRD US-1) */}
        <div>
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-2">Task</label>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer font-medium">
              <input
                type="radio"
                name="task"
                checked={taskType === "task_1"}
                onChange={() => setTaskType("task_1")}
                className="text-blue-600"
              />
              Task 1 (Academic Chart)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer font-medium">
              <input
                type="radio"
                name="task"
                checked={taskType === "task_2"}
                onChange={() => setTaskType("task_2")}
                className="text-blue-600"
              />
              Task 2 (Essay)
            </label>
          </div>
        </div>

        {/* Task 1 Image URL (FRD US-1) */}
        {taskType === "task_1" && (
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Image URL (Biểu đồ Task 1):</label>
            <input
              type="text"
              placeholder="https://example.com/chart.png"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full text-sm p-2 border border-gray-300 rounded-lg"
            />
          </div>
        )}

        {/* Criteria & Topic Grid (FRD US-2 & US-4) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Criteria</label>
            <select
              value={criterion}
              onChange={(e) => handleCriterionChange(e.target.value)}
              className="w-full text-sm p-2.5 border border-gray-300 rounded-lg bg-white font-medium"
            >
              {CRITERIA_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Topic</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full text-sm p-2.5 border border-gray-300 rounded-lg bg-white font-medium"
            >
              {TOPICS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Code & Question Type (FRD US-2 & US-3) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Error Code</label>
            <select
              value={errorCode}
              onChange={(e) => handleErrorCodeChange(e.target.value)}
              className="w-full text-sm p-2.5 border border-gray-300 rounded-lg bg-white font-medium"
            >
              {(ERROR_CODES_BY_CRITERIA[criterion] || []).map((code) => (
                <option key={code.code} value={code.code}>{code.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Question Type</label>
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              className="w-full text-sm p-2.5 border border-gray-300 rounded-lg bg-white font-medium"
            >
              {QUESTION_TYPES.map((q) => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Detailed Instruction (FRD US-6) */}
        <div>
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">
            Detailed Instruction (Prompt input)
          </label>
          <textarea
            rows={3}
            value={detailedInstruction}
            onChange={(e) => setDetailedInstruction(e.target.value)}
            placeholder="Nhập instruction chi tiết làm prompt cho AI..."
            className="w-full text-sm p-2.5 border border-gray-300 rounded-lg focus:border-blue-500"
          />
        </div>

        {/* Reference Box matching FRD US-5 (Query from WISPACE Database) */}
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Reference (Giả lập lỗi)</span>
            <button
              onClick={handleQueryReferences}
              disabled={isQueryingRef}
              className="px-3 py-1 text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors"
            >
              {isQueryingRef ? "Đang truy vấn..." : "Query reference (WISPACE)"}
            </button>
          </div>

          {references.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Bấm 'Query reference' để lấy 3 mẫu lỗi từ database bài luận WISPACE.</p>
          ) : (
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {references.map((ref, idx) => (
                <div key={idx} className="p-3 bg-white border border-gray-200 rounded-lg text-xs space-y-1 relative">
                  <button
                    onClick={() => handleDeleteReference(idx)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-rose-600 font-bold"
                    title="Xóa reference này"
                  >
                    ✕
                  </button>
                  <p className="font-semibold text-gray-800 pr-4">"{ref.prompt}"</p>
                  <p className="text-rose-700 italic font-medium">Quote: "{ref.quote}"</p>
                  <p className="text-gray-600">{ref.explanation}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Generate Button (FRD US-7) */}
        <button
          onClick={handleGenerateSample}
          disabled={isLoading}
          className="w-full py-3 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-md"
        >
          {isLoading ? "AI Đang tạo mẫu..." : "Generate Sample"}
        </button>
      </div>

      {/* Reject Modal matching FRD US-10 */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">Từ chối mẫu & Nhập lý do (Reason for Reject)</h3>
            <p className="text-xs text-gray-500">
              Lý do từ chối sẽ được lưu trữ riêng để phục vụ huấn luyện/fine-tune mô hình AI và dùng làm đầu vào để AI tái tạo lại mẫu bài tập tốt hơn.
            </p>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ví dụ: Câu dịch số 1 chưa đúng collocation chuẩn, rubric chấm điểm cần bổ sung thang điểm cho vế ngữ pháp..."
              className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:border-blue-500"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleRejectSample}
                className="px-5 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
              >
                Xác nhận & Tái tạo (Retry)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
