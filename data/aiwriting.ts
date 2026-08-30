/**
 * Nguồn sự thật duy nhất cho enum của AIWriting.
 *
 * Bám theo `docs/doc-api-micro.md`. Ba tài liệu đang mâu thuẫn nhau về cách
 * viết tiêu chí thứ 5 (`grammar_range_accuracy` / `grammatical_range_accuracy`
 * / `grammatical_range`) — xem mục 6.1 của `docs/design/2026-08-15-demo-page-spec.md`.
 * Khi backend chốt lại, chỉ cần sửa file này.
 */

export const TOPICS = ["environment", "technology", "education"] as const;
export type Topic = (typeof TOPICS)[number];

export const TOPIC_LABELS: Record<Topic, string> = {
  environment: "Environment",
  technology: "Technology",
  education: "Education",
};

export type WritingTask = 1 | 2;

export type Criterion =
  | "task_achievement"
  | "task_response"
  | "coherence_cohesion"
  | "lexical_resource"
  | "grammar_range_accuracy";

/** `tasks` là các Task mà tiêu chí này áp dụng. */
export const CRITERIA: Array<{
  value: Criterion;
  label: string;
  tasks: WritingTask[];
}> = [
  { value: "task_achievement", label: "Task Achievement", tasks: [1] },
  { value: "task_response", label: "Task Response", tasks: [2] },
  { value: "coherence_cohesion", label: "Coherence & Cohesion", tasks: [1, 2] },
  { value: "lexical_resource", label: "Lexical Resource", tasks: [1, 2] },
  { value: "grammar_range_accuracy", label: "Grammatical Range & Accuracy", tasks: [1, 2] },
];

export type ExerciseType =
  | "multiple_choice_single"
  | "multiple_choice_multiple"
  | "gap_filling"
  | "choose_from_list"
  | "reorder"
  | "annotation"
  | "short_writing";

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  multiple_choice_single: "Trắc nghiệm một đáp án",
  multiple_choice_multiple: "Trắc nghiệm nhiều đáp án",
  gap_filling: "Điền vào chỗ trống",
  choose_from_list: "Chọn từ danh sách",
  reorder: "Sắp xếp lại thứ tự",
  annotation: "Đánh dấu trong câu",
  short_writing: "Viết ngắn",
};

export type ErrorCode = {
  value: string;
  label: string;
  criterion: Criterion;
  /** Dạng bài và số câu do mã lỗi quyết định — xem doc-api-micro.md mục 1.2. */
  exerciseType: ExerciseType;
  numberOfQuestions: number;
  aiGrading: boolean;
};

function code(
  value: string,
  label: string,
  criterion: Criterion,
  exerciseType: ExerciseType,
): ErrorCode {
  const aiGrading = exerciseType === "short_writing";
  return {
    value,
    label,
    criterion,
    exerciseType,
    numberOfQuestions: aiGrading ? 3 : 10,
    aiGrading,
  };
}

const TASK_1_CODES: Array<[string, string, ExerciseType]> = [
  ["inappropriate_structure", "Inappropriate structure", "multiple_choice_single"],
  ["poor_detail_selection", "Poor detail selection", "multiple_choice_multiple"],
  ["missing_data_support", "Missing data support", "multiple_choice_multiple"],
  ["inaccurate_data_support", "Inaccurate data support", "multiple_choice_multiple"],
  ["lack_comparison_analysis", "Lack of comparison/analysis", "annotation"],
];

const TASK_2_CODES: Array<[string, string, ExerciseType]> = [
  ["unclear_stance", "Unclear stance", "multiple_choice_multiple"],
  ["inconsistent_argument", "Inconsistent argument", "multiple_choice_multiple"],
  ["irrelevant_argument", "Irrelevant argument", "annotation"],
  ["logical_fallacy", "Logical fallacy", "multiple_choice_single"],
  ["incomplete_task_coverage", "Incomplete task coverage", "multiple_choice_multiple"],
  ["underdeveloped_reasoning", "Underdeveloped reasoning", "multiple_choice_single"],
];

export const ERROR_CODES: ErrorCode[] = [
  ...TASK_1_CODES.map(([v, l, t]) => code(v, l, "task_achievement", t)),
  ...TASK_2_CODES.map(([v, l, t]) => code(v, l, "task_response", t)),

  code("disorganized_structure", "Disorganized structure", "coherence_cohesion", "reorder"),
  code("unclear_information_relationship", "Unclear information relationship", "coherence_cohesion", "multiple_choice_single"),
  code("inappropriate_linking_device", "Inappropriate linking device", "coherence_cohesion", "gap_filling"),
  code("misplaced_emphasis", "Misplaced emphasis", "coherence_cohesion", "multiple_choice_single"),
  code("repetitive_language_structure", "Repetitive language structure", "coherence_cohesion", "multiple_choice_multiple"),
  code("wordy_expression", "Wordy expression", "coherence_cohesion", "short_writing"),

  code("inappropriate_word_choice", "Inappropriate word choice", "lexical_resource", "choose_from_list"),
  code("collocation_error", "Collocation error", "lexical_resource", "short_writing"),
  code("lexical_repetition", "Lexical repetition", "lexical_resource", "multiple_choice_multiple"),
  code("spelling_error", "Spelling error", "lexical_resource", "short_writing"),
  code("informal_vocabulary", "Informal vocabulary", "lexical_resource", "multiple_choice_single"),

  code("limited_sentence_variety", "Limited sentence variety", "grammar_range_accuracy", "short_writing"),
  code("verb_form_error", "Verb form error", "grammar_range_accuracy", "gap_filling"),
  code("article_number_error", "Article/number error", "grammar_range_accuracy", "choose_from_list"),
  code("word_form_error", "Word form error", "grammar_range_accuracy", "annotation"),
  code("inappropriate_tense_structure", "Inappropriate tense structure", "grammar_range_accuracy", "multiple_choice_single"),
  code("complex_structure_error", "Complex structure error", "grammar_range_accuracy", "multiple_choice_single"),
];

export function criteriaForTask(task: WritingTask) {
  return CRITERIA.filter((c) => c.tasks.includes(task));
}

export function errorCodesForCriterion(criterion: Criterion) {
  return ERROR_CODES.filter((c) => c.criterion === criterion);
}

export function findErrorCode(criterion: Criterion, value: string) {
  return ERROR_CODES.find((c) => c.criterion === criterion && c.value === value);
}

/** Số reference mặc định khi query — `num_references` cho phép 1–5. */
export const DEFAULT_NUM_REFERENCES = 3;

/**
 * [ASSUMPTION] `question_type` lọc reference theo dạng đề bài gốc (vd. đề Task 2
 * dạng agree_disagree). Cơ sở: tool thật có ô "Question Type" cạnh Task/Topic/
 * Criteria/Error Code (xem ảnh chụp trong hội thoại thiết kế). Rủi ro nếu sai:
 * thấp — đây là input để lọc mock reference, không phải input của
 * /create-micro-exercise, nên đổi lại không ảnh hưởng hợp đồng API thật.
 *
 * Danh sách Task 2 lấy từ docs/discussions/2026-08-06-aiwriting-exercise-api.md
 * (agree_disagree, both_views, short_writing). Task 1 chưa có tài liệu liệt kê,
 * dùng bộ dạng đề Task 1 IELTS phổ biến.
 */
export const QUESTION_TYPES_BY_TASK: Record<WritingTask, Array<{ value: string; label: string }>> = {
  1: [
    { value: "line_graph", label: "Line graph" },
    { value: "bar_chart", label: "Bar chart" },
    { value: "pie_chart", label: "Pie chart" },
    { value: "table", label: "Table" },
    { value: "process_diagram", label: "Process diagram" },
    { value: "map", label: "Map" },
  ],
  2: [
    { value: "agree_disagree", label: "Agree/Disagree" },
    { value: "both_views", label: "Both views" },
    { value: "short_writing", label: "Short writing" },
  ],
};
