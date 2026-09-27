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
      "AIHUB cấp API key cho Organization, mỗi key gắn với một Environment và chỉ chạy trên server của bạn. Key hiển thị đúng một lần lúc tạo hoặc xoay vòng — lưu vào secret manager ngay. Key thiếu scope writing.grade sẽ bị từ chối với 403 FORBIDDEN.",
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

/**
 * Body Task 2 dùng chung. Trang API reference và Sample request trong Console
 * cùng đọc từ đây, nên request mẫu không thể lệch khỏi hợp đồng.
 */
export const WRITING_TASK2_REQUEST = {
  question:
    "Some people believe that universities should only offer academic subjects, while others think vocational training is equally important. Discuss both views and give your own opinion.",
  topic: "education",
  essay:
    "Universities have traditionally focused on academic subjects, yet the value of vocational training is increasingly recognised. An academic education develops the ability to analyse and argue, which serves a society that needs a critical mass of researchers and policy makers. Vocational training, by contrast, turns that analysis into a specific craft, and a society also needs people who can build, repair and maintain. Neither path is complete alone: a trained technician who cannot reason about a problem will repeat the same mistake, and a graduate who cannot make anything will theorise about work they have never done. I therefore consider vocational training a subject a university should offer, provided it carries the same status and the same faculty as academic study.",
};

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
          "Bài mô tả đúng dạng biểu đồ và so sánh được giữa các nước, nhưng chưa nêu xu hướng của toàn bộ khoảng thời gian.",
        strengths: [
          "Mở bài nêu đúng đơn vị và khoảng thời gian của biểu đồ.",
          "So sánh Saudi Arabia với các nước còn lại bằng con số cụ thể.",
        ],
        improvements: [
          "Thêm một câu tổng kết xu hướng chung thay vì dừng ở nhóm nước đầu.",
        ],
      },
      {
        id: "coherence_cohesion",
        name: "Coherence and Cohesion",
        band: 6.5,
        band_reason:
          "Bài chia thành bốn đoạn theo trục so sánh rõ ràng, từ nối dùng đúng chỗ nhưng hơi lặp.",
        strengths: [
          "Mỗi đoạn có một chức năng: mở bài, dẫn số chính, chi tiết, kết.",
          "Dùng However và In comparison đúng chỗ chuyển ý.",
        ],
        improvements: [
          "Bỏ các cụm liên kết lặp lại như It is clear that ở đầu câu.",
        ],
      },
      {
        id: "lexical_resource",
        name: "Lexical Resource",
        band: 6.0,
        band_reason:
          "Từ vựng đúng ngữ cảnh biểu đồ nhưng còn nhiều cụm chung chung, thiếu từ chuyên ngành.",
        strengths: [
          "Dùng đúng estimated production capacity thay cho số lượng dài dòng.",
        ],
        improvements: [
          "Thay increase mạnh bằng từ chỉ biến động có hướng như surge hoặc decline.",
        ],
      },
      {
        id: "grammatical_range_accuracy",
        name: "Grammatical Range and Accuracy",
        band: 6.5,
        band_reason:
          "Câu ngắn và câu ghép xen kẽ, lỗi ít và không ảnh hưởng nghĩa.",
        strengths: [
          "So sánh bằng mệnh đề quan hệ và cấu trúc as ... as chính xác.",
        ],
        improvements: ["Rà lại chủ ngữ số nhiều đi cùng động từ số ít."],
      },
    ],
    summary:
      "Bài đạt band 6.5, mô tả và so sánh đúng dữ liệu nhưng thiếu câu tổng kết xu hướng chung. Điểm yếu rõ nhất nằm ở từ vựng chuyên ngành và cụm từ liên kết lặp lại.",
    suggestions: [
      "Thêm một câu tổng kết xu hướng chung của cả biểu đồ trước khi kết bài.",
      "Dùng từ chuyên ngành cho biến động thay cho các động từ chung.",
    ],
    next_steps: [
      "Luyện 3 bài Task 1 có biểu đồ cột và soạn lại phần tổng kết xu hướng.",
      "Đọc lại bài và gạch chân mọi cụm liên kết lặp lại.",
    ],
    annotations: [
      {
        criterion: "lexical_resource",
        issue: "collocation_error",
        quote: "a big increase of production",
        explanation:
          "Increase đi với in, không đi với of. Đúng là an increase in production.",
      },
      {
        criterion: "grammatical_range_accuracy",
        issue: "inappropriate_structure",
        quote: "Norway and Mexico produced were considerably less",
        explanation:
          "Hai nước này là chủ ngữ số nhiều nhưng were không đi với chúng. Đúng là Norway and Mexico produced considerably less.",
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
          "Bài trả lời đúng hai quan điểm và có nêu ý riêng, nhưng chưa nói rõ điều kiện để theo phía nào.",
        strengths: [
          "Nêu quan điểm cá nhân ở câu cuối thay vì để ngỏ.",
          "Phản biện lập luận đối diện bằng một ví dụ cụ thể.",
        ],
        improvements: [
          "Nêu rõ điều kiện áp dụng quan điểm cá nhân, nếu không người đọc vẫn chưa biết bạn chọn phía nào.",
        ],
      },
      {
        id: "coherence_cohesion",
        name: "Coherence and Cohesion",
        band: 7.0,
        band_reason:
          "Mạch lập luận đi từ phân đôi vấn đề tới hòa giải, liên kết mềm và đúng.",
        strengths: ["Mỗi đoạn có một ý chính và kết thúc nối sang đoạn sau."],
        improvements: ["Hai mệnh đề dài ở nửa sau làm nhịp đọc chậm lại."],
      },
      {
        id: "lexical_resource",
        name: "Lexical Resource",
        band: 7.0,
        band_reason:
          "Từ vựng học thuật đa dạng, chính tả ổn, lỗi còn lại ở cụm collocation.",
        strengths: [
          "Dùng chính xác vocational training và academic subject theo nghĩa của đề.",
        ],
        improvements: [
          "Sửa cụm a trained technician who cannot reason để tránh lặp cannot.",
        ],
      },
      {
        id: "grammatical_range_accuracy",
        name: "Grammatical Range and Accuracy",
        band: 7.0,
        band_reason:
          "Câu ghép và mệnh đề quan hệ dùng linh hoạt, lỗi nhỏ không cản trôi chảy.",
        strengths: [
          "Cấu trúc provided it carries the same status là câu chủ động phức đúng ngữ pháp.",
        ],
        improvements: ["Một mệnh đề dài ở đoạn cuối nên tách thành hai câu."],
      },
    ],
    summary:
      "Bài đạt band 7.0, lập luận rõ và có ví dụ cho cả hai phía. Điểm cần nâng là quan điểm cá nhân chưa kèm điều kiện, và có hai mệnh đề quá dài.",
    suggestions: [
      "Nêu điều kiện áp dụng quan điểm cá nhân ở câu kết.",
      "Tách hai mệnh đề dài thành bốn câu ngắn.",
    ],
    next_steps: [
      "Luyện 2 bài Task 2 dạng discuss both views và thêm một ví dụ cho cả hai phía.",
    ],
    annotations: [
      {
        criterion: "lexical_resource",
        issue: "collocation_error",
        quote: "will repeat the same mistake",
        explanation:
          "Repeat a mistake không phải collocation tiếng Anh. Đúng là make the same mistake.",
      },
      {
        criterion: "task_response",
        issue: "unclear_stance",
        quote: "I therefore consider vocational training a subject",
        explanation:
          "Ý kiến cá nhân đã có nhưng chưa nêu điều kiện áp dụng, nên lập luận còn đứng giữa hai quan điểm.",
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
      "Dùng lại một key với body khác, hoặc một request giống hệt đang chạy. Body khác thì lấy key mới; request đang chạy thì chờ nó xong rồi gửi lại cùng key và cùng body.",
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
      "Đã dùng hết hạn mức request trong tháng. Chờ kỳ reset hoặc nâng hạn mức.",
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
    description: "Dịch vụ AI trả về lỗi. Thử lại sau nếu retryable là true.",
    retryable: true,
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
    description: "Dịch vụ AI đang throttle. Lùi rồi thử lại.",
    retryable: true,
    retry_after_ms: 2000,
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
    title: "JWKS endpoint của bạn không truy cập được",
    description:
      "Chỉ xảy ra khi bạn gửi Signed User Assertion và AIHUB không lấy được JWKS endpoint của bạn. API key của bạn vẫn tốt — kiểm tra JWKS endpoint, đổi mới key sẽ không giúp ích.",
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
        "19 mã dưới đây áp dụng cho cả hai endpoint chấm. Mọi lỗi trả về cùng một envelope { error: { code, message, request_id, retryable, retry_after_ms? } }. Rẽ nhánh theo code chứ không theo message, vì message có thể đổi câu chữ; chỉ retry khi retryable là true, và luôn gửi lại cùng một Idempotency-Key khi retry chấm Writing.",
      items: WRITING_SCORING_ERRORS,
    },
  },
};
