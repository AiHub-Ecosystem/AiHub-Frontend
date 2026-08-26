import {
  CRITERIA,
  ERROR_CODES,
  QUESTION_TYPES_BY_TASK,
  findErrorCode,
  type Criterion,
  type ErrorCode,
  type ExerciseType,
  type Topic,
  type WritingTask,
} from "@/data/aiwriting";

/**
 * Sinh dữ liệu mock cho demo "Tạo bài tập" — dùng chung cho 2 route handler
 * dưới app/api/demo/exercise-generation/*. Không gọi AI thật, không đọc DB
 * thật; chỉ dựng dữ liệu trông hợp lý để minh hoạ đúng hình dạng response.
 */

// ---------------------------------------------------------------------------
// Bước 1: sample-references — mô phỏng docs/briefapiinput.md
// ---------------------------------------------------------------------------

const TASK1_OPENER: Record<string, string> = {
  line_graph: "The line graph below shows",
  bar_chart: "The bar chart below compares",
  pie_chart: "The pie charts below show",
  table: "The table below shows",
  process_diagram: "The diagram below shows",
  map: "The maps below show",
};

const TOPIC_SUBJECT: Record<Topic, string> = {
  environment: "carbon emissions by sector between 1990 and 2020",
  technology: "smartphone ownership by age group between 2010 and 2020",
  education: "government spending on primary and secondary education by country",
};

const TASK2_PROMPTS: Record<Topic, Record<string, string>> = {
  environment: {
    agree_disagree:
      "The best way to solve the world's environmental problems is to increase the cost of fuel for cars and other vehicles. To what extent do you agree or disagree?",
    both_views:
      "Some people think governments should invest in public transport to reduce pollution, while others believe individuals should be responsible for reducing their own carbon footprint. Discuss both views and give your opinion.",
    short_writing:
      "Explain the main causes of deforestation and suggest possible solutions.",
  },
  technology: {
    agree_disagree:
      "Technology has made people more isolated rather than more connected. To what extent do you agree or disagree?",
    both_views:
      "Some people believe children should learn to use computers at a very young age, while others think this is unnecessary. Discuss both views and give your opinion.",
    short_writing: "Describe how artificial intelligence is changing the way people work.",
  },
  education: {
    agree_disagree:
      "University education should be free for all students. To what extent do you agree or disagree?",
    both_views:
      "Some people think students should choose their own subjects, while others believe schools should decide for them. Discuss both views and give your opinion.",
    short_writing: "Explain the advantages and disadvantages of online learning.",
  },
};

const TASK1_IMAGE =
  "https://www.ielts-exam.net/ielts_practice_tests_19/IELTS-Academic-Writing-Task1-Water-Cycle.jpg";

/**
 * Bài mẫu quote + giải thích cho từng mã lỗi. Một dòng cho mỗi mã trong số 28
 * mã — dùng chung cho mọi topic/task vì đây là demo, không phải dữ liệu thật
 * lấy từ DB WISPACE.
 */
const ERROR_SAMPLES: Record<string, { quote: string; explanation: string }> = {
  inappropriate_structure: {
    quote: "In conclusion, I think that first of all we should consider the data shows.",
    explanation: "Câu mở đoạn kết luận lại chèn cấu trúc liệt kê, không phù hợp với đoạn tổng kết.",
  },
  poor_detail_selection: {
    quote: "The chart shows many things about the years from 1990 to 2007 in general.",
    explanation: "Chi tiết chọn quá chung chung, không nêu được số liệu nổi bật nhất của biểu đồ.",
  },
  missing_data_support: {
    quote: "Electricity usage increased a lot during this period.",
    explanation: "Thiếu số liệu cụ thể (từ bao nhiêu lên bao nhiêu) để hỗ trợ nhận định.",
  },
  inaccurate_data_support: {
    quote: "Domestic emissions reached 3.3 million tonnes in 2007.",
    explanation: "Số liệu trích dẫn sai — theo biểu đồ, mức 3.3 triệu tấn thuộc năm 1990, không phải 2007.",
  },
  lack_comparison_analysis: {
    quote: "Both sectors increased over the period.",
    explanation: "Câu chỉ mô tả xu hướng chung, thiếu so sánh mức độ tăng giữa hai lĩnh vực.",
  },
  unclear_stance: {
    quote: "There are some good points on both sides of this issue.",
    explanation: "Câu này không thể hiện rõ người viết đứng về phía nào.",
  },
  inconsistent_argument: {
    quote: "Technology is harmful, but I also think it helps society develop faster.",
    explanation: "Hai vế mâu thuẫn nhau trong cùng một câu mà không có liên kết giải thích.",
  },
  irrelevant_argument: {
    quote: "My personal computer often crashes when I open too many tabs.",
    explanation: "Chi tiết cá nhân này không liên quan đến luận điểm đang triển khai.",
  },
  logical_fallacy: {
    quote: "Everyone I know supports this policy, so it must be correct.",
    explanation: "Đây là ngụy biện 'appeal to popularity' — số đông ủng hộ không chứng minh tính đúng đắn.",
  },
  incomplete_task_coverage: {
    quote: "In this essay, I will discuss the advantages of this approach.",
    explanation: "Đề bài yêu cầu bàn cả ưu và nhược điểm, bài chỉ mới đề cập một phía.",
  },
  underdeveloped_reasoning: {
    quote: "This is important because it matters a lot to everyone.",
    explanation: "Lý do đưa ra chưa được giải thích rõ tại sao nó quan trọng.",
  },
  disorganized_structure: {
    quote: "Firstly... Also as I said before... in addition to the first point...",
    explanation: "Các đoạn không theo trình tự logic, ý bị lặp và nhảy cóc.",
  },
  unclear_information_relationship: {
    quote: "The government invested more money. Fewer students dropped out.",
    explanation: "Hai câu đặt cạnh nhau nhưng không có từ nối thể hiện quan hệ nhân quả.",
  },
  inappropriate_linking_device: {
    quote: "Moreover, students dropped out because of financial issues.",
    explanation: "'Moreover' dùng để thêm ý, không phù hợp để nối một câu mang quan hệ nguyên nhân.",
  },
  misplaced_emphasis: {
    quote: "Only in developing countries do students face this problem, mostly.",
    explanation: "Trạng từ nhấn mạnh đặt sai vị trí khiến câu tối nghĩa.",
  },
  repetitive_language_structure: {
    quote: "The data shows that emissions rose. The data shows that costs rose too.",
    explanation: "Lặp lại cùng một cấu trúc mở đầu ở nhiều câu liên tiếp.",
  },
  wordy_expression: {
    quote: "Due to the fact that the weather was cold, we decided to stay inside.",
    explanation: "'Due to the fact that' có thể rút gọn thành 'because' cho súc tích hơn.",
  },
  inappropriate_word_choice: {
    quote: "The government did a big effort to fix the problem.",
    explanation: "'Did a big effort' không phải cách dùng tự nhiên; nên dùng 'made a significant effort'.",
  },
  collocation_error: {
    quote: "Forests play an important job in absorbing carbon dioxide.",
    explanation: "Collocation đúng phải là 'play a crucial role', không phải 'play a job'.",
  },
  lexical_repetition: {
    quote: "The problem is a big problem that causes many problems for society.",
    explanation: "Từ 'problem' bị lặp lại ba lần trong một câu.",
  },
  spelling_error: {
    quote: "The goverment should invest in reneweble energy.",
    explanation: "Sai chính tả: 'goverment' → 'government', 'reneweble' → 'renewable'.",
  },
  informal_vocabulary: {
    quote: "A lot of people think this stuff is a big deal nowadays.",
    explanation: "'stuff' và 'a big deal' quá thân mật cho văn phong học thuật.",
  },
  limited_sentence_variety: {
    quote: "It is good. It helps people. It saves time. It is popular.",
    explanation: "Toàn câu đơn ngắn lặp lại cùng một cấu trúc chủ ngữ-động từ.",
  },
  verb_form_error: {
    quote: "By 2020, renewable energy have become more common.",
    explanation: "Cần dùng 'had become' (quá khứ hoàn thành) thay vì 'have become'.",
  },
  article_number_error: {
    quote: "Government should provide an educations for every child.",
    explanation: "'educations' là danh từ không đếm được, không dùng số nhiều hay mạo từ 'an'.",
  },
  word_form_error: {
    quote: "This has a significant influential on the economy.",
    explanation: "Cần dùng danh từ 'influence', không phải tính từ 'influential'.",
  },
  inappropriate_tense_structure: {
    quote: "Since 2010, smartphone ownership rises steadily.",
    explanation: "Với 'since + mốc thời gian', cần dùng thì hiện tại hoàn thành: 'has risen'.",
  },
  complex_structure_error: {
    quote: "Although the cost is high, but many families still choose private schools.",
    explanation: "Không dùng đồng thời 'although' và 'but' trong cùng một câu phức.",
  },
};

export type MockReference = {
  question: {
    prompt: string;
    image: string | null;
    imageDescription: string | null;
    questionType: string;
  };
  comments: Array<{ quote: string; explanation: string }>;
};

export type ReferenceQuery = {
  writingTask: WritingTask;
  topic: Topic;
  criterion: Criterion;
  errorCode: string;
  questionType?: string;
  numReferences: number;
};

export type ReferenceValidationError = { loc: string[]; msg: string };

export function validateReferenceQuery(body: unknown): ReferenceValidationError[] {
  const errors: ReferenceValidationError[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  const writingTask = b.writingTask;
  if (writingTask !== 1 && writingTask !== 2) {
    errors.push({ loc: ["body", "writingTask"], msg: "writingTask phải là 1 hoặc 2" });
  }
  if (!TOPIC_SUBJECT[b.topic as Topic]) {
    errors.push({ loc: ["body", "topic"], msg: "topic không hợp lệ" });
  }
  const criterionDef = CRITERIA.find((c) => c.value === b.criterion);
  if (!criterionDef) {
    errors.push({ loc: ["body", "criterion"], msg: "criterion không hợp lệ" });
  } else if (
    (writingTask === 1 || writingTask === 2) &&
    !criterionDef.tasks.includes(writingTask as WritingTask)
  ) {
    errors.push({
      loc: ["body", "criterion"],
      msg: `criterion "${criterionDef.value}" không áp dụng cho writingTask=${writingTask}`,
    });
  }
  if (criterionDef && !findErrorCode(criterionDef.value, String(b.errorCode))) {
    errors.push({ loc: ["body", "errorCode"], msg: "errorCode không thuộc criterion đã chọn" });
  }
  const num = b.numReferences;
  if (num !== undefined && (typeof num !== "number" || num < 1 || num > 5)) {
    errors.push({ loc: ["body", "numReferences"], msg: "numReferences phải trong khoảng 1–5" });
  }
  return errors;
}

function buildPrompt(task: WritingTask, topic: Topic, questionType: string): string {
  if (task === 1) {
    const opener = TASK1_OPENER[questionType] ?? TASK1_OPENER.line_graph;
    return `${opener} ${TOPIC_SUBJECT[topic]}. Summarize the information by selecting and reporting the main features, and make comparisons where relevant.`;
  }
  return TASK2_PROMPTS[topic][questionType] ?? TASK2_PROMPTS[topic].agree_disagree;
}

/**
 * `criterion` được trả về dưới dạng display name, cố tình lặp lại đúng lỗi hợp
 * đồng đã ghi ở docs/design/2026-08-15-demo-page-spec.md mục 6.7 (response của
 * sample-references không feed thẳng được vào create-micro-exercise). Phía
 * client phải tự map ngược trước khi gọi bước sinh bài tập.
 */
export function sampleReferences(query: ReferenceQuery) {
  const criterionDef = CRITERIA.find((c) => c.value === query.criterion)!;
  const sample = ERROR_SAMPLES[query.errorCode] ?? {
    quote: "(chưa có câu mẫu cho mã lỗi này)",
    explanation: "(chưa có giải thích mẫu cho mã lỗi này)",
  };
  const questionType =
    query.questionType || QUESTION_TYPES_BY_TASK[query.writingTask][0].value;

  const references: MockReference[] = Array.from({ length: query.numReferences }, (_, i) => ({
    question: {
      prompt: buildPrompt(query.writingTask, query.topic, questionType),
      image: query.writingTask === 1 ? TASK1_IMAGE : null,
      imageDescription:
        query.writingTask === 1
          ? `Minh hoạ số liệu ${TOPIC_SUBJECT[query.topic]}, dùng làm ngữ cảnh cho tham chiếu #${i + 1}.`
          : null,
      questionType,
    },
    comments: [sample],
  }));

  return {
    topic: query.topic,
    writing_task: query.writingTask,
    criterion: criterionDef.label,
    error_code: query.errorCode,
    references,
  };
}

// ---------------------------------------------------------------------------
// Bước 2: create-micro-exercise — mô phỏng docs/doc-api-micro.md
// ---------------------------------------------------------------------------

export type GenerateRequest = {
  topic: Topic;
  writingTask: WritingTask;
  criterion: Criterion;
  errorCode: string;
  instruction?: string;
  references: MockReference[];
};

export function validateGenerateRequest(body: unknown): ReferenceValidationError[] {
  const errors = validateReferenceQuery(body as ReferenceQuery);
  const b = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(b.references) || b.references.length === 0) {
    errors.push({ loc: ["body", "references"], msg: "cần ít nhất một reference" });
  }
  return errors;
}

type QuestionCtx = { topicLabel: string; errorLabel: string; hasImage: boolean };

/**
 * [ASSUMPTION] doc-api-micro.md chỉ cho ví dụ JSON đầy đủ cho
 * `multiple_choice_single` và `short_writing` (mục 1.4). Cấu trúc của 5 dạng
 * còn lại (multiple_choice_multiple, gap_filling, choose_from_list, reorder,
 * annotation) là suy đoán hợp lý, chưa được backend xác nhận — xem
 * docs/design/2026-08-15-demo-page-spec.md mục 6.8.
 */
function buildQuestion(type: ExerciseType, index: number, ctx: QuestionCtx): Record<string, unknown> {
  const questionsNo = index + 1;
  const questionImage = ctx.hasImage ? TASK1_IMAGE : null;

  switch (type) {
    case "multiple_choice_single":
      return {
        questions_no: questionsNo,
        question_text: `Chọn câu viết đúng nhất để khắc phục lỗi "${ctx.errorLabel}" khi viết về chủ đề ${ctx.topicLabel}.`,
        question_image: questionImage,
        explanation: `Đáp án A khắc phục đúng lỗi "${ctx.errorLabel}"; các phương án còn lại vẫn mắc lỗi tương tự.`,
        options: {
          A: "Governments play a crucial role in reducing emissions through policy.",
          B: "Governments did a big effort for reducing emissions through policy.",
          C: "Government provide a policy for reduce emissions.",
          D: "Emissions reducing is a policy that government provide it.",
        },
        correct: "A",
      };
    case "multiple_choice_multiple":
      return {
        questions_no: questionsNo,
        question_text: `Chọn tất cả các câu mắc lỗi "${ctx.errorLabel}" trong đoạn văn về ${ctx.topicLabel}.`,
        question_image: questionImage,
        explanation: `Các câu B và D lặp lại đúng lỗi "${ctx.errorLabel}" đã nêu trong reference.`,
        options: {
          A: "This trend continued steadily throughout the period.",
          B: "The data shows that the data indicates a clear pattern.",
          C: "Renewable energy usage increased significantly after 2015.",
          D: "The problem is a big problem for every problem in the city.",
        },
        correct: ["B", "D"],
      };
    case "gap_filling":
      return {
        questions_no: questionsNo,
        question_text: `Điền từ còn thiếu để câu không còn mắc lỗi "${ctx.errorLabel}": "By 2020, renewable energy ___ (become) more common."`,
        question_image: questionImage,
        explanation: `Cần thì quá khứ hoàn thành để khớp với mốc thời gian "By 2020": "had become".`,
        correct: "had become",
      };
    case "choose_from_list":
      return {
        questions_no: questionsNo,
        question_text: `Chọn từ phù hợp nhất thay cho phần in nghiêng để tránh lỗi "${ctx.errorLabel}": "This has a significant *influential* on the economy."`,
        question_image: questionImage,
        choices: ["influence", "influenced", "influencing", "influential"],
        explanation: `Vị trí sau "significant" cần danh từ "influence", không phải tính từ "influential".`,
        correct: "influence",
      };
    case "reorder":
      return {
        questions_no: questionsNo,
        question_text: `Sắp xếp lại các câu sau theo đúng trình tự logic để đoạn văn về ${ctx.topicLabel} không còn mắc lỗi "${ctx.errorLabel}".`,
        question_image: questionImage,
        items: [
          "Finally, the government introduced a new subsidy scheme.",
          "At first, renewable energy adoption remained low.",
          "As a result, adoption rates rose sharply within two years.",
          "However, costs began to fall after 2015.",
        ],
        explanation: "Thứ tự đúng theo quan hệ nhân quả: bối cảnh → thay đổi → chính sách → kết quả.",
        correct: [1, 2, 0, 3],
      };
    case "annotation":
      return {
        questions_no: questionsNo,
        question_text: `Đánh dấu cụm từ mắc lỗi "${ctx.errorLabel}" trong câu sau: "Forests play an important job in absorbing carbon dioxide."`,
        question_image: questionImage,
        explanation: `Cụm "play an important job" mắc lỗi — collocation đúng là "play a crucial role".`,
        correct: "play an important job",
      };
    case "short_writing":
      return {
        questions_no: questionsNo,
        question_text: `Viết lại câu sau để khắc phục lỗi "${ctx.errorLabel}": "Forests play an important job in absorbing carbon dioxide."`,
        question_image: questionImage,
        explanation: `Cần dùng cụm "play a crucial role in + V-ing" thay vì "play an important job in".`,
        hint: ["play a crucial role", `chủ đề: ${ctx.topicLabel}`],
        correct: {
          sample_answer: "Forests play a crucial role in absorbing carbon dioxide and regulating climate.",
          ai_grading_rubric:
            "Chấm điểm trên thang 1–10 dựa trên: (1) dùng đúng collocation, (2) ngữ pháp chính xác, (3) từ vựng phù hợp chủ đề.",
        },
      };
  }
}

export function generateExercise(
  req: GenerateRequest,
  topicLabel: string,
  errorCode: ErrorCode,
) {
  const ctx: QuestionCtx = {
    topicLabel,
    errorLabel: errorCode.label,
    hasImage: req.writingTask === 1,
  };
  const exercise = Array.from({ length: errorCode.numberOfQuestions }, (_, i) =>
    buildQuestion(errorCode.exerciseType, i, ctx),
  );

  return {
    success: true,
    message: "Tạo bài tập micro thành công",
    data: {
      meta: {
        id: `micro_${Date.now()}_${errorCode.value}`,
        type: errorCode.exerciseType,
        ai_grading: errorCode.aiGrading ? "true" : "false",
        error_code: errorCode.value,
        difficulty: "B2",
        instruction:
          req.instruction?.trim() ||
          `Luyện tập khắc phục lỗi "${errorCode.label}" trong chủ đề ${topicLabel}.`,
        number_of_questions: errorCode.numberOfQuestions,
      },
      exercise,
    },
  };
}

export function findAllErrorCodes(): ErrorCode[] {
  return ERROR_CODES;
}
