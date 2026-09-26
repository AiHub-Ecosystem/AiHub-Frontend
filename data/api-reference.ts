/**
 * Nội dung tài liệu (trang Document) cho từng endpoint — trích nguyên văn từ
 * docs/briefapiinput.md và docs/doc-api-micro.md, KHÔNG chỉnh sửa lại cho
 * nhất quán như data/demo-mock.ts đã làm cho phần mock demo.
 *
 * Lý do giữ nguyên: trang Document mô tả hợp đồng API đang được tài liệu hoá
 * — kể cả những chỗ hai tài liệu chưa khớp nhau. Ghi rõ trong `notes` thay vì
 * âm thầm sửa, để người đọc biết chỗ nào cần backend xác nhận trước khi tích
 * hợp thật.
 */

export type SchemaField = {
  name: string;
  type: string;
  required: boolean;
  description: string;
};

export type IntegrationStep = {
  title: string;
  description: string;
};

export type EndpointReference = {
  slug: string;
  requestFields: SchemaField[];
  requestExample: unknown;
  responseDescription: string;
  responseExample: unknown;
  notes: string[];
};

export const EXERCISE_GENERATION_OVERVIEW = {
  summary:
    "Sinh bài tập luyện viết bám đúng lỗi sai của học viên, dựa trên bài làm thật đã được gán nhãn lỗi trong hệ thống WISPACE.",
  facts: [
    { label: "Base URL", value: "test-api-ielts-writing.aihubproduction.com" },
    { label: "Định dạng", value: "application/json" },
    {
      label: "Xác thực",
      value: "API Key (x-client-id / x-secret-key) hoặc Bearer Token",
    },
    { label: "Trạng thái", value: "Stable" },
  ],
};

export const EXERCISE_GENERATION_STEPS: IntegrationStep[] = [
  {
    title: "Chọn tiêu chí cần luyện",
    description:
      "Xác định writing_task (1 hoặc 2), topic (environment | technology | education), criterion và error_code tương ứng. error_code sẽ quyết định dạng bài và số câu sinh ra ở bước 3, không cần chọn tay.",
  },
  {
    title: "Lấy dữ liệu tham chiếu",
    description:
      "Gọi sample-references để lấy các bài làm thật chứa đúng lỗi cần luyện, dùng làm ngữ cảnh cho AI. Nếu DB chưa đủ dữ liệu, endpoint trả 404 — cho phép người dùng tự nhập reference bằng tay.",
  },
  {
    title: "Sinh bài tập",
    description:
      "Gọi create-micro-exercise (một lỗi) hoặc create-longwriting-exercise (nhiều lỗi cùng lúc) với reference vừa lấy được. Response theo cơ chế graceful fallback — luôn trả 200, nếu AI sinh lỗi định dạng thì exercise rỗng kèm message giải thích thay vì trả lỗi 500.",
  },
  {
    title: "Duyệt và quyết định",
    description:
      "Xem trước bài tập (bản render hoặc JSON thô), Accept nếu đạt hoặc Retry kèm lý do để sinh lại. Bản nháp AI gốc và bản đã chỉnh sửa nên được lưu tách biệt để dùng làm dữ liệu fine-tuning sau này.",
  },
];

export const EXERCISE_GENERATION_REFERENCE: Record<string, EndpointReference> =
  {
    "sample-references": {
      slug: "sample-references",
      requestFields: [
        {
          name: "writing_task",
          type: "int",
          required: true,
          description: "1 hoặc 2",
        },
        {
          name: "criterion",
          type: "string",
          required: true,
          description:
            "task_achievement | task_response | coherence_cohesion | lexical_resource | grammatical_range_accuracy",
        },
        {
          name: "error_code",
          type: "string",
          required: true,
          description: "Một trong 28 mã lỗi thuộc criterion đã chọn",
        },
        {
          name: "topic",
          type: "string",
          required: true,
          description: "environment | technology | education",
        },
        {
          name: "num_references",
          type: "int",
          required: false,
          description: "1–5, mặc định 3",
        },
      ],
      requestExample: {
        writing_task: 2,
        criterion: "lexical_resource",
        error_code: "collocation_error",
        topic: "environment",
        num_references: 3,
      },
      responseDescription:
        "Object tương thích với InputMicroExercise, dùng làm input cho create-micro-exercise.",
      responseExample: {
        topic: "environment",
        writing_task: 2,
        criterion: "Lexical Resource",
        error_code: "collocation_error",
        references: [
          {
            question: {
              prompt:
                "The best way to solve the world's environmental problem is to increase the cost of fuel for cars and other vehicles. To what extent do you agree or disagree?",
              question_type: "agree_disagree",
            },
            comments: [
              {
                quote:
                  "Forests do a crucial role in absorbing carbon dioxide...",
                explanation: "Collocation đúng phải là 'play a crucial role'.",
              },
            ],
          },
        ],
      },
      notes: [
        'criterion trong response là display name ("Lexical Resource"), không phải enum — phải map ngược trước khi gọi create-micro-exercise.',
        'Tài liệu ghi criterion enum là "grammatical_range_accuracy", trong khi create-micro-exercise dùng "grammar_range_accuracy" — hai tài liệu chưa thống nhất cách viết.',
        "Không có base URL công khai — đây là endpoint nội bộ, chưa tài liệu hoá cơ chế xác thực.",
      ],
    },

    "create-micro-exercise": {
      slug: "create-micro-exercise",
      requestFields: [
        {
          name: "topic",
          type: "string",
          required: true,
          description: "Ví dụ: environment, family, education",
        },
        {
          name: "writing_task",
          type: "1 | 2",
          required: true,
          description: "Loại Task IELTS Writing",
        },
        {
          name: "criterion",
          type: "string",
          required: true,
          description:
            "Task 1: task_achievement — Task 2: task_response — chung: coherence_cohesion, lexical_resource, grammar_range_accuracy",
        },
        {
          name: "error_code",
          type: "string",
          required: true,
          description: "Mã lỗi cụ thể",
        },
        {
          name: "references",
          type: "array",
          required: true,
          description:
            "Danh sách bài mẫu chứa lỗi của học viên, lấy từ sample-references",
        },
      ],
      requestExample: {
        topic: "environment",
        writing_task: 2,
        criterion: "lexical_resource",
        error_code: "collocation_error",
        references: [
          {
            question: {
              prompt:
                "The best way to solve the world's environmental problem is to increase the cost of fuel for cars and other vehicles. To what extent do you agree or disagree?",
              question_type: "agree_disagree",
            },
            comments: [
              {
                quote:
                  "Forests do a crucial role in absorbing carbon dioxide...",
                explanation: "Collocation đúng phải là 'play a crucial role'.",
              },
            ],
          },
        ],
      },
      responseDescription:
        "Bài tập ứng với dạng bài do error_code quyết định (xem bảng ánh xạ trong tài liệu gốc). Ví dụ dưới đây là dạng multiple_choice_single.",
      responseExample: {
        success: true,
        message: "Tạo bài tập micro thành công",
        data: {
          meta: {
            id: "micro_1718812345_abcdef",
            type: "multiple_choice_single",
            ai_grading: "false",
            error_code: "inappropriate_structure",
            difficulty: "B2",
            instruction: "Yêu cầu bài tập tổng quát tự động khớp theo mã lỗi",
            number_of_questions: 10,
          },
          exercise: [
            {
              questions_no: 1,
              question_text:
                "Chọn câu viết có cấu trúc phù hợp nhất để thể hiện xu hướng tăng của biểu đồ.",
              explanation:
                "Đáp án A đúng vì sử dụng cấu trúc ngữ pháp chính xác và trang trọng.",
              options: {
                A: "There was a significant increase in the number of visitors.",
                B: "The number of visitors was increase significantly.",
                C: "Visitors increasing significant in the period.",
                D: "It had a significantly increasing of visitors.",
              },
              correct: "A",
            },
          ],
        },
      },
      notes: [
        'ai_grading trả về dạng string ("true"/"false"), không phải boolean.',
        "Chỉ có ví dụ response đầy đủ cho 2/7 dạng bài (multiple_choice_single, short_writing) — 5 dạng còn lại chưa được backend cho ví dụ.",
        "Luôn trả 200 kể cả khi AI sinh lỗi định dạng (graceful fallback) — kiểm tra exercise.length thay vì dựa vào status code để biết có sinh thành công hay không.",
      ],
    },

    "create-longwriting-exercise": {
      slug: "create-longwriting-exercise",
      requestFields: [
        {
          name: "topic",
          type: "string",
          required: true,
          description: "Ví dụ: AI, Education",
        },
        {
          name: "writing_task",
          type: "1 | 2",
          required: true,
          description: "Loại Task IELTS Writing",
        },
        {
          name: "errors",
          type: "array",
          required: true,
          description:
            "Danh sách mẫu lỗi cần khắc phục đồng thời, mỗi phần tử gồm error_no, criterion, error_code, references[]",
        },
      ],
      requestExample: {
        topic: "AI, Education",
        writing_task: 2,
        errors: [
          {
            error_no: 1,
            criterion: "task_response",
            error_code: "unclear_stance",
            references: [],
          },
        ],
      },
      responseDescription:
        "Một đoạn văn thân bài (50–100 từ) khắc phục đồng thời các lỗi đã liệt kê, luôn cần AI chấm điểm.",
      responseExample: {
        success: true,
        message: "Tạo bài tập long writing thành công",
        data: {
          meta: {
            id: "lw_1718812345_abcdef",
            type: "long_writing",
            ai_grading: "true",
            error_code: [
              "unclear_stance",
              "inappropriate_linking_device",
              "complex_structure_error",
            ],
            difficulty: "B2",
            topic: "AI, Education",
            instruction: "Yêu cầu bài tập chi tiết hướng dẫn khắc phục các lỗi",
            number_of_questions: 1,
          },
          exercise: [
            {
              questions_no: 1,
              question_text:
                "Viết MỘT ĐOẠN VĂN THÂN BÀI về chủ đề AI trong giáo dục...",
              hint: [
                "Quan điểm: Thể hiện sự đồng ý rõ ràng với việc áp dụng AI.",
                "Lý do: AI giúp cá nhân hóa lộ trình học tập.",
              ],
              correct: {
                sample_answer:
                  "On the one hand, implementing AI in education brings significant benefits...",
                ai_grading_rubric:
                  "Chấm điểm trên thang 1-10 dựa trên: (1) khắc phục lỗi stance không rõ ràng, (2) dùng từ nối hợp lý, (3) cấu trúc câu phức đúng ngữ pháp.",
              },
            },
          ],
        },
      },
      notes: [
        'ai_grading luôn là "true" — không có nhánh không-chấm-điểm cho dạng long writing.',
      ],
    },
  };

export type RequestHeader = { name: string; value: string };

export type ErrorResponse = {
  status: string;
  /** Mã lỗi máy đọc được, khi API product có (vd. `UNAUTHORIZED`). */
  code?: string;
  tone: "ok" | "warn" | "error";
  title: string;
  description: string;
  example: unknown;
};

const EXERCISE_GENERATION_ERRORS: ErrorResponse[] = [
  {
    status: "200",
    tone: "ok",
    title: "Graceful fallback",
    description:
      "AI sinh lỗi định dạng hoặc vi phạm schema validation. Hệ thống không trả 500 mà trả 200 kèm exercise rỗng.",
    example: {
      success: true,
      message:
        "Lỗi parse JSON hoặc validate từ AI. Trả về kết quả mặc định rỗng.",
      data: { meta: { number_of_questions: 0 }, exercise: [] },
    },
  },
  {
    status: "422",
    tone: "warn",
    title: "Sai quy tắc dữ liệu request",
    description:
      "Thiếu trường bắt buộc, sai kiểu dữ liệu, hoặc error_code không hợp lệ cho task/criterion.",
    example: {
      detail: [
        {
          loc: ["body", "criterion"],
          msg: "Value error, Invalid criterion for task 1",
          type: "value_error",
        },
      ],
    },
  },
  {
    status: "404",
    tone: "warn",
    title: "Không đủ reference (chỉ sample-references)",
    description: "DB chưa có đủ bài làm thật khớp điều kiện lọc.",
    example: {
      error: "Not enough references found",
      available: 1,
      requested: 3,
    },
  },
  {
    status: "500",
    tone: "error",
    title: "Lỗi server / LLM",
    description:
      "Lỗi hệ thống không lường trước, nạp API key LLM thất bại, hoặc mất kết nối mạng.",
    example: { detail: "Failed to load LLM" },
  },
];

/** Tra theo slug sản phẩm — mở rộng khi Chấm điểm / Tạo roadmap có tài liệu. */
export const PRODUCT_DOCS: Record<
  string,
  {
    overview: typeof EXERCISE_GENERATION_OVERVIEW;
    steps: IntegrationStep[];
    /** Header chung cho mọi endpoint của API product, theo thứ tự hiển thị. */
    headers: RequestHeader[];
    reference: Record<string, EndpointReference>;
    errors: { intro: string; items: ErrorResponse[] };
  }
> = {
  "exercise-generation": {
    overview: EXERCISE_GENERATION_OVERVIEW,
    steps: EXERCISE_GENERATION_STEPS,
    headers: [{ name: "Content-Type", value: "application/json" }],
    reference: EXERCISE_GENERATION_REFERENCE,
    errors: {
      intro:
        "Áp dụng chung cho các endpoint sinh bài tập trong docs/doc-api-micro.md.",
      items: EXERCISE_GENERATION_ERRORS,
    },
  },
};
