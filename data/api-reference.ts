import { WRITING_TASK2_REQUEST } from "@/data/writing-task2-request";

export { WRITING_TASK2_REQUEST };

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
  /** Dong shell chen truoc lenh curl, vi du gan bien moi truoc khi goi. */
  requestPreamble?: string[];
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

export const WRITING_SCORING_OVERVIEW = {
  summary:
    "Chấm bài viết IELTS Writing theo 4 tiêu chí, trả về band từng tiêu chí kèm lý do, góp ý và trích dẫn đúng câu cần sửa trong bài.",
  facts: [
    { label: "Base URL", value: "api.aihubproduction.com" },
    { label: "Định dạng", value: "application/json" },
    {
      label: "Xác thực",
      value: "API key (scope writing.grade) + X-User-Identity (bắt buộc)",
    },
    { label: "Idempotency-Key", value: "Bắt buộc, giữ 24 giờ" },
    { label: "Trạng thái", value: "Stable" },
  ],
};

export const WRITING_SCORING_STEPS: IntegrationStep[] = [
  {
    title: "Lấy API key có scope writing.grade",
    description:
      "AIHUB cấp API key cho Organization, mỗi key chỉ dùng được trong các Environment được phép và nên được gọi từ server của bạn. Key hiển thị đúng một lần lúc tạo hoặc xoay vòng — lưu vào secret manager ngay. Key thiếu scope writing.grade sẽ bị từ chối với 403 FORBIDDEN.",
  },
  {
    title: "Chọn đúng dạng User Identity của Organization",
    description:
      "Cả hai endpoint đều là user-scoped nên X-User-Identity không được thiếu. Organization có Identity configuration đang hoạt động thì gửi Signed User Assertion — một JWT ngắn hạn do backend của bạn ký; Organization chưa có cấu hình nào đang hoạt động (kể cả cấu hình bị tắt) thì gửi Declared User ID dạng văn bản thuần, 1–256 ký tự ASCII hiển thị, không có khoảng trắng. Cấu hình của Organization quyết định dạng, không phải hình dạng giá trị.",
  },
  {
    title: "Gán một Idempotency-Key cho mỗi lần chấm",
    description:
      "Chấm Writing có phí và có thể mất tới 60 giây. Mỗi lần chấm — mỗi bài làm — cần một Idempotency-Key riêng. Retry thì gửi lại đúng key cũ và đúng body cũ: AIHUB trả lại kết quả đã lưu kèm header Idempotent-Replay: true thay vì chấm lại. Đổi bất kỳ trường nào trong body thì phải lấy key mới, nếu không sẽ nhận 409 IDEMPOTENCY_CONFLICT.",
  },
  {
    title: "Gửi đề bài và bài làm",
    description:
      "Task 1 cần thêm image_url tới một ảnh biểu đồ mà dịch vụ chấm truy cập được, cùng chart_type đúng loại biểu đồ. Task 2 không cần ảnh, chỉ cần topic. Cả hai đều trả nhận xét tiếng Việt. Đặt timeout phía client tối thiểu 90 giây.",
  },
  {
    title: "Hiển thị feedback theo đúng thứ tự tiêu chí",
    description:
      "criteria luôn có đúng 4 phần tử theo thứ tự cố định; Task 1 bắt đầu bằng task_achievement, Task 2 bắt đầu bằng task_response. annotations trích nguyên văn câu trong bài kèm criterion và issue, dùng để ghim nhận xét vào đúng chỗ.",
  },
];

/** Cùng áp dụng cho cả hai endpoint chấm, nên chỉ viết một lần. */
const WRITING_SHARED_NOTES = [
  "Đổi bất kỳ trường nào trong body thì phải dùng một Idempotency-Key mới, nếu không sẽ nhận 409 IDEMPOTENCY_CONFLICT.",
  "Body vượt 256 KB trả về 413 PAYLOAD_TOO_LARGE. Trường lạ trong body bị từ chối chứ không bị bỏ qua.",
  "Ngân sách 60 giây của gateway là trần của phía server — đặt timeout phía client tối thiểu 90 giây. Bản ghi Idempotency-Key giữ 24 giờ.",
];

/** `data` giống nhau ở cả hai task, chỉ khác tiêu chí đầu tiên. */
const writingResponseDescription = (firstCriterion: string) =>
  `Envelope { data, meta } của AIHUB. data khớp hợp đồng chấm bài: overall_band chạy từ 0 đến 9 theo bội số 0.5, criteria luôn có đúng 4 phần tử theo thứ tự cố định (bắt đầu bằng ${firstCriterion}), kèm summary, suggestions, next_steps và annotations trích nguyên văn câu trong bài. meta cho request_id để báo hỗ trợ, service, operation và các số đo thời gian; correlation_id chỉ xuất hiện khi bạn gửi X-Correlation-Id.`;

const WRITING_CURL_PREAMBLE = [
  "# Ba biến dưới là ví dụ — thay bằng giá trị thật của bạn, và chỉ chạy trên server của bạn.",
  'AIHUB_API_KEY="aihub_sk_..."            # API key của Organization, có scope writing.grade',
  'AIHUB_USER_IDENTITY="$SIGNED_USER_ASSERTION"   # Organization có Identity configuration đang hoạt động',
  '# AIHUB_USER_IDENTITY="student_456"     # thay bằng Declared User ID nếu Organization chưa có Identity configuration đang hoạt động',
  "",
  "# Gán UUID MỘT LẦN cho mỗi lần chấm, rồi dùng lại nguyên biến này khi retry.",
  "# Chạy lại dòng này = một lần chấm mới, bị tính phí thêm.",
  'AIHUB_IDEMPOTENCY_KEY="$(uuidgen)"',
  "",
];

const WRITING_RESPONSE_ENVELOPE = {
  request_id: "req_01M23NT8MJW22AYX6FVT17F5XF",
  service: "writing",
  timing: { downstream_ms: 41820, gateway_overhead_ms: 184, total_ms: 42004 },
};

const WRITING_TASK1_RESPONSE = {
  data: {
    overall_band: 6.5,
    language: "vi",
    criteria: [
      {
        id: "task_achievement",
        name: "Task Achievement",
        band: 6.5,
        band_reason:
          "Bài có overview và so sánh các nước, nhưng dùng từ chỉ mức tăng cho biểu đồ chỉ có một năm và chưa nêu số của Russia.",
        strengths: [
          "Mở bài nêu đúng đại lượng và năm 2010.",
          "Có câu Overall nêu đặc điểm chính của biểu đồ.",
        ],
        improvements: [
          "Nêu số của Russia và mô tả chênh lệch thay cho xu hướng tăng.",
        ],
      },
      {
        id: "coherence_cohesion",
        name: "Coherence and Cohesion",
        band: 6.5,
        band_reason:
          "Ý đi từ số lớn đến số nhỏ và có câu Overall, nhưng toàn bài dồn vào một đoạn.",
        strengths: ["Câu Overall tóm tắt đặc điểm chính."],
        improvements: ["Tách mở bài và overview khỏi phần số liệu."],
      },
      {
        id: "lexical_resource",
        name: "Lexical Resource",
        band: 6.0,
        band_reason:
          "Dùng đúng production capacity nhưng big increase of production vừa sai ngữ cảnh vừa thiếu chính xác.",
        strengths: [
          "Dùng đúng estimated production capacity thay cho số lượng dài dòng.",
        ],
        improvements: [
          "Dùng a large gap in production capacity để nói về chênh lệch giữa các nước.",
        ],
      },
      {
        id: "grammatical_range_accuracy",
        name: "Grammatical Range and Accuracy",
        band: 6.5,
        band_reason:
          "Các câu so sánh phần lớn dễ hiểu, nhưng một câu thừa động từ were sau produced.",
        strengths: [
          "Cụm almost three times the figure for Russia diễn đạt so sánh rõ.",
        ],
        improvements: ["Bỏ were sau produced trong câu về Norway và Mexico."],
      },
    ],
    summary:
      "Bài đạt band 6.5 và có overview, nhưng nói về mức tăng dù biểu đồ chỉ có năm 2010, bỏ số của Russia và có một câu sai cấu trúc.",
    suggestions: [
      "Bổ sung số ước tính của Russia và tách phần overview thành đoạn riêng.",
      "Dùng từ chỉ chênh lệch thay cho increase ở biểu đồ một năm.",
    ],
    next_steps: [
      "Luyện mô tả biểu đồ cột chỉ có một mốc thời gian.",
      "Rà lại các câu so sánh để tránh thừa động từ.",
    ],
    annotations: [
      {
        criterion: "lexical_resource",
        issue: "collocation_error",
        quote: "a big increase of production",
        explanation:
          "Biểu đồ chỉ có năm 2010 nên không thể kết luận sản lượng tăng; dùng a large gap in production capacity để nói về chênh lệch.",
      },
      {
        criterion: "grammatical_range_accuracy",
        issue: "inappropriate_structure",
        quote: "Norway and Mexico produced were considerably less",
        explanation:
          "Thừa were sau produced. Viết Norway and Mexico produced considerably less.",
      },
    ],
  },
  meta: { ...WRITING_RESPONSE_ENVELOPE, operation: "writing.task1.grade" },
};

const WRITING_TASK2_RESPONSE = {
  data: {
    overall_band: 7.0,
    language: "vi",
    criteria: [
      {
        id: "task_response",
        name: "Task Response",
        band: 7.0,
        band_reason:
          "Bài bàn cả hai quan điểm và kết luận ủng hộ đào tạo nghề với điều kiện được coi trọng ngang các môn học thuật; ví dụ minh họa còn khái quát.",
        strengths: [
          "Nêu quan điểm cá nhân ở câu cuối thay vì để ngỏ.",
          "Câu kết nêu rõ điều kiện same status and the same faculty.",
        ],
        improvements: [
          "Thêm ví dụ cụ thể về một chương trình đào tạo nghề trong đại học.",
        ],
      },
      {
        id: "coherence_cohesion",
        name: "Coherence and Cohesion",
        band: 7.0,
        band_reason:
          "Các ý nối theo trình tự rõ, nhưng toàn bài dồn vào một đoạn và câu Neither path is complete alone quá dài.",
        strengths: [
          "Các câu nối trực tiếp từ lợi ích học thuật sang đào tạo nghề.",
        ],
        improvements: [
          "Tách phần học thuật và phần đào tạo nghề thành hai đoạn.",
        ],
      },
      {
        id: "lexical_resource",
        name: "Lexical Resource",
        band: 7.0,
        band_reason:
          "Từ vựng học thuật phù hợp, nhưng turns that analysis into a specific craft là phép diễn đạt trừu tượng.",
        strengths: [
          "Dùng chính xác vocational training và academic subject theo nghĩa của đề.",
        ],
        improvements: ["Nêu kỹ năng thực hành cụ thể thay cho specific craft."],
      },
      {
        id: "grammatical_range_accuracy",
        name: "Grammatical Range and Accuracy",
        band: 7.0,
        band_reason:
          "Câu ghép và mệnh đề điều kiện dùng đúng, nhưng câu Neither path is complete alone chứa quá nhiều ý.",
        strengths: [
          "Cấu trúc provided it carries the same status là câu chủ động phức đúng ngữ pháp.",
        ],
        improvements: [
          "Tách câu Neither path is complete alone thành hai câu.",
        ],
      },
    ],
    summary:
      "Bài đạt band 7.0, nêu rõ quan điểm và điều kiện trong kết luận. Cần ví dụ cụ thể hơn, chia đoạn và rút ngắn một câu dài.",
    suggestions: [
      "Thêm ví dụ về chương trình đào tạo nghề trong đại học.",
      "Tách phần học thuật và đào tạo nghề thành các đoạn riêng.",
    ],
    next_steps: [
      "Viết lại bài với các đoạn riêng và một ví dụ thực tế cho quan điểm cá nhân.",
    ],
    annotations: [
      {
        criterion: "lexical_resource",
        issue: "imprecise_word_choice",
        quote: "turns that analysis into a specific craft",
        explanation:
          "Cách diễn đạt trừu tượng; nêu rõ đào tạo nghề giúp người học phát triển kỹ năng thực hành cụ thể.",
      },
      {
        criterion: "task_response",
        issue: "underdeveloped_example",
        quote:
          "provided it carries the same status and the same faculty as academic study",
        explanation:
          "Điều kiện đã rõ nhưng cần một ví dụ về cách đại học trao vị thế tương đương cho đào tạo nghề.",
      },
    ],
  },
  meta: { ...WRITING_RESPONSE_ENVELOPE, operation: "writing.task2.grade" },
};

export const WRITING_SCORING_REFERENCE: Record<string, EndpointReference> = {
  "grade-task1": {
    slug: "grade-task1",
    requestPreamble: WRITING_CURL_PREAMBLE,
    requestFields: [
      {
        name: "question",
        type: "string",
        required: true,
        description: "Đề bài mô tả biểu đồ, 1–2.000 ký tự.",
      },
      {
        name: "chart_type",
        type: "string",
        required: true,
        description:
          "Loại biểu đồ, phân biệt HOA THƯỜNG, đúng một trong: Bar Chart | Line Graph | Pie Chart | Table | Map | Process Diagram | Multiple Graphs.",
      },
      {
        name: "essay",
        type: "string",
        required: true,
        description: "Bài làm Task 1, 1–20.000 ký tự.",
      },
      {
        name: "image_url",
        type: "string (uri)",
        required: true,
        description:
          "Ảnh biểu đồ dạng HTTP(S), tối đa 2.000 ký tự. Phải trỏ tới ảnh thật mà dịch vụ chấm tải được.",
      },
      {
        name: "language",
        type: "string",
        required: false,
        description:
          "Ngôn ngữ nhận xét. Hiện chỉ nhận vi; nhận xét luôn trả về bằng tiếng Việt.",
      },
    ],
    requestExample: {
      question:
        "The chart below shows the estimated oil production capacity of several countries in 2010. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
      chart_type: "Bar Chart",
      image_url: "https://example.com/ielts-task1/oil-production-chart.png",
      essay:
        "The bar chart illustrates the estimated oil production capacity of four countries in 2010, showing a big increase of production in the two largest producers. Saudi Arabia led the group at roughly 10 million barrels per day, almost three times the figure for Russia. Norway and Mexico produced were considerably less, at about 1.6 and 2.5 million barrels respectively. Overall, oil production was heavily concentrated in a small number of countries.",
    },
    responseDescription: writingResponseDescription("task_achievement"),
    responseExample: WRITING_TASK1_RESPONSE,
    notes: [
      "image_url trong ví dụ là URL giữ chỗ — thay bằng ảnh biểu đồ thật mà dịch vụ chấm truy cập được, nếu không kết quả sẽ sai.",
      'chart_type phân biệt HOA THƯỜNG và chỉ nhận 7 giá trị đã liệt kê; gửi "bar chart" hoặc một chủ đề như "environment" đều bị 400 INVALID_REQUEST.',
      ...WRITING_SHARED_NOTES,
    ],
  },

  "grade-task2": {
    slug: "grade-task2",
    requestPreamble: WRITING_CURL_PREAMBLE,
    requestFields: [
      {
        name: "question",
        type: "string",
        required: true,
        description: "Đề bài luận, 1–2.000 ký tự.",
      },
      {
        name: "topic",
        type: "string",
        required: true,
        description:
          "Chủ đề thật của bài như education hoặc technology, 1–200 ký tự. Đây là môn chủ đề, không phải loại biểu đồ.",
      },
      {
        name: "essay",
        type: "string",
        required: true,
        description: "Bài làm Task 2, 1–20.000 ký tự.",
      },
      {
        name: "language",
        type: "string",
        required: false,
        description:
          "Ngôn ngữ nhận xét. Hiện chỉ nhận vi; nhận xét luôn trả về bằng tiếng Việt.",
      },
    ],
    requestExample: WRITING_TASK2_REQUEST,
    responseDescription: writingResponseDescription("task_response"),
    responseExample: WRITING_TASK2_RESPONSE,
    notes: [
      "topic là bắt buộc và là môn chủ đề, khác với chart_type của Task 1.",
      "Task 2 không có image_url hay chart_type; gửi kèm hai trường đó vẫn bị 400 INVALID_REQUEST chứ không bị bỏ qua.",
      ...WRITING_SHARED_NOTES,
    ],
  },
};

type GatewayError = Omit<ErrorResponse, "example"> & {
  retryable?: boolean;
  retry_after_ms?: number;
};

/** 19 mã lỗi của gateway, nhóm theo HTTP status thật của từng mã. */
const WRITING_GATEWAY_ERRORS: GatewayError[] = [
  {
    status: "400",
    code: "INVALID_REQUEST",
    tone: "warn",
    title: "Request không hợp lệ",
    description:
      "Body sai kiểu dữ liệu, thiếu trường bắt buộc, quá độ dài, có trường lạ, hoặc Idempotency-Key thiếu/rỗng/quá 255 byte. Sửa request rồi gọi lại; retry y hệt là vô nghĩa.",
  },
  {
    status: "401",
    code: "UNAUTHORIZED",
    tone: "error",
    title: "API key không hợp lệ",
    description:
      "Thiếu, không nhận ra, đã thu hồi hoặc hết hạn API key. Key hiển thị một lần lúc tạo nên cần xoay vòng nếu đã mất.",
  },
  {
    status: "401",
    code: "USER_IDENTITY_REQUIRED",
    tone: "error",
    title: "Thiếu User Identity",
    description:
      "Gọi endpoint user-scoped mà không có X-User-Identity. Cả hai endpoint chấm đều cần header này.",
  },
  {
    status: "401",
    code: "INVALID_USER_IDENTITY",
    tone: "error",
    title: "User Identity không hợp lệ",
    description:
      "Declared User ID vi phạm quy tắc 1–256 ký tự ASCII không khoảng trắng, hoặc Signed User Assertion không vượt kiểm chữ ký. Không có fallback: cấu hình Identity active buộc phải dùng Signed User Assertion.",
  },
  {
    status: "403",
    code: "FORBIDDEN",
    tone: "error",
    title: "Thiếu scope",
    description:
      "API key không có scope writing.grade. Liên hệ AIHUB để mở rộng scope của key.",
  },
  {
    status: "403",
    code: "ENVIRONMENT_NOT_ALLOWED",
    tone: "error",
    title: "Sai Environment",
    description:
      "Key chỉ chạy ở Environment khác với hostname đang gọi. Dùng đúng key của host đó; client không chọn Environment bằng header.",
  },
  {
    status: "404",
    code: "NOT_FOUND",
    tone: "warn",
    title: "Sai route",
    description:
      "Không có route này. Các operation chấm nằm dưới /v1/ielts/..., ví dụ /v1/writing/task2/grade là 404.",
  },
  {
    status: "409",
    code: "IDEMPOTENCY_CONFLICT",
    tone: "warn",
    title: "Xung đột Idempotency-Key",
    description:
      "Dùng lại một key với body khác, hoặc một request giống hệt đang chạy. retryable là false nên không gửi lại ngay; body khác thì lấy key mới, còn request đang chạy thì chờ nó xong rồi gửi lại cùng key và cùng body.",
  },
  {
    status: "413",
    code: "PAYLOAD_TOO_LARGE",
    tone: "warn",
    title: "Body vượt 256 KB",
    description: "Body lớn hơn giới hạn của endpoint. Rút ngắn bài làm.",
  },
  {
    status: "429",
    code: "RATE_LIMITED",
    tone: "error",
    title: "Vượt rate limit",
    description:
      "Quá nhiều request mỗi phút. Nghỉ đúng retry_after_ms rồi thử lại.",
    retryable: true,
    retry_after_ms: 2000,
  },
  {
    status: "429",
    code: "CONCURRENCY_LIMIT",
    tone: "error",
    title: "Vượt giới hạn song song",
    description:
      "Quá nhiều request đang chạy cùng lúc. Giảm số request chạy song song thay vì chờ lâu hơn.",
    retryable: true,
    retry_after_ms: 500,
  },
  {
    status: "429",
    code: "QUOTA_EXCEEDED",
    tone: "error",
    title: "Hết hạn mức",
    description:
      "Đã dùng hết hạn mức request trong tháng. retryable là true và retry_after_ms cho biết thời gian còn lại đến đầu tháng UTC tới; chờ kỳ reset hoặc nâng hạn mức.",
    retryable: true,
    retry_after_ms: 86_400_000,
  },
  {
    status: "500",
    code: "INTERNAL_ERROR",
    tone: "error",
    title: "Lỗi phía AIHUB",
    description:
      "Lỗi không lường trước ở phía chúng tôi. Mã này luôn có retryable là false — báo lại kèm request_id thay vì retry.",
  },
  {
    status: "502",
    code: "AI_SERVICE_ERROR",
    tone: "error",
    title: "Dịch vụ AI lỗi",
    description:
      "Dịch vụ AI trả về lỗi. retryable là false với lỗi 4xx từ dịch vụ AI (như ví dụ), true với lỗi 5xx; chỉ thử lại khi response thực tế cho phép.",
  },
  {
    status: "502",
    code: "AI_SERVICE_CONTRACT_VIOLATION",
    tone: "error",
    title: "Dịch vụ AI sai hợp đồng",
    description:
      "Dịch vụ AI trả về cấu trúc không hợp lệ. Không retry; báo lại kèm request_id.",
  },
  {
    status: "503",
    code: "AI_SERVICE_THROTTLED",
    tone: "error",
    title: "Dịch vụ AI đang giới hạn",
    description:
      "Dịch vụ AI đang giới hạn. Lùi rồi thử lại; mã này không có retry_after_ms nên chọn thời gian lùi phù hợp.",
    retryable: true,
  },
  {
    status: "503",
    code: "AI_SERVICE_UNAVAILABLE",
    tone: "error",
    title: "Dịch vụ AI không truy cập được",
    description: "Không tới được dịch vụ AI. Thử lại với backoff.",
    retryable: true,
  },
  {
    status: "503",
    code: "IDENTITY_PROVIDER_UNAVAILABLE",
    tone: "error",
    title: "Nguồn xác minh User Identity không khả dụng",
    description:
      "AIHUB không đọc được Identity configuration của Organization, hoặc không lấy được JWKS khi xác minh Signed User Assertion. Lỗi đọc cấu hình có thể xảy ra cả khi bạn dùng Declared User ID; không tự chuyển sang chế độ khác. API key vẫn hợp lệ.",
    retryable: true,
  },
  {
    status: "504",
    code: "AI_SERVICE_TIMEOUT",
    tone: "error",
    title: "Hết thời gian chấm",
    description:
      "Chấm vượt ngân sách 60 giây. Retry bằng chính Idempotency-Key cũ: nếu lần chấm nền đã xong, kết quả được trả lại mà không tính phí thêm.",
    retryable: true,
  },
];

const WRITING_SCORING_ERRORS: ErrorResponse[] = WRITING_GATEWAY_ERRORS.map(
  ({ status, code, tone, title, description, retryable, retry_after_ms }) => ({
    status,
    code,
    tone,
    title,
    description,
    example: {
      error: {
        code,
        message: "…",
        request_id: "req_01M23NT8MJW22AYX6FVT17F5XF",
        retryable: retryable ?? false,
        ...(retry_after_ms === undefined ? {} : { retry_after_ms }),
      },
    },
  })
);

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

export type ProductDocs = {
  overview: typeof EXERCISE_GENERATION_OVERVIEW;
  steps: IntegrationStep[];
  /** Header chung cho mọi endpoint của API product, theo thứ tự hiển thị. */
  headers: RequestHeader[];
  reference: Record<string, EndpointReference>;
  errors: { intro: string; items: ErrorResponse[] };
};

/** Tra theo slug sản phẩm — mở rộng khi Tạo roadmap có tài liệu. */
export const PRODUCT_DOCS: Record<string, ProductDocs> = {
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
  scoring: {
    overview: WRITING_SCORING_OVERVIEW,
    steps: WRITING_SCORING_STEPS,
    headers: [
      { name: "X-API-Key", value: "$AIHUB_API_KEY" },
      { name: "X-User-Identity", value: "$AIHUB_USER_IDENTITY" },
      { name: "Idempotency-Key", value: "$AIHUB_IDEMPOTENCY_KEY" },
      { name: "Content-Type", value: "application/json" },
    ],
    reference: WRITING_SCORING_REFERENCE,
    errors: {
      intro:
        "19 mã dưới đây áp dụng cho cả hai endpoint chấm. Mọi lỗi trả về cùng một envelope { error: { code, message, request_id, retryable, retry_after_ms? } }. Giá trị retry_after_ms trong ví dụ chỉ minh họa; hãy dùng giá trị response thực tế. Rẽ nhánh theo code chứ không theo message, vì message có thể đổi câu chữ. Chỉ tự động retry khi retryable là true và luôn giữ cùng Idempotency-Key; riêng 409 do request giống hệt đang chạy thì chờ request đầu hoàn tất rồi gửi lại cùng key và body.",
      items: WRITING_SCORING_ERRORS,
    },
  },
};
