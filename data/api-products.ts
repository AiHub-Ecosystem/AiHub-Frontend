/**
 * Danh mục API của AIHub. Dùng chung cho `/product` và `/demo`.
 *
 * Mô tả sản phẩm hiện là bản nháp, chờ Product duyệt lại.
 */

export type ProductStatus = "stable" | "beta" | "coming-soon";

export const STATUS_LABELS: Record<ProductStatus, string> = {
  stable: "Stable",
  beta: "Beta",
  "coming-soon": "Coming Soon",
};

export type ApiEndpoint = {
  slug: string;
  name: string;
  method: "GET" | "POST";
  path: string;
  summary: string;
};

export type ApiProduct = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  status: ProductStatus;
  /** Sản phẩm có demo trong kế hoạch. */
  hasDemo: boolean;
  /** Màn demo chi tiết đã dựng xong chưa — chỉ khi true mới cho bấm vào. */
  demoReady: boolean;
  endpoints: ApiEndpoint[];
};

export type ApiCategory = {
  slug: string;
  name: string;
  description: string;
  products: ApiProduct[];
};

export const API_CATEGORIES: ApiCategory[] = [
  {
    slug: "ai-writing",
    name: "Giải pháp AI Writing",
    description:
      "Bộ API xử lý bài viết IELTS — chấm điểm, sinh bài tập bám đúng lỗi sai, và dựng lộ trình luyện tập cá nhân hoá.",
    products: [
      {
        slug: "scoring",
        name: "Chấm điểm",
        tagline: "Chấm bài viết theo 4 tiêu chí IELTS",
        description:
          "Trả về điểm từng tiêu chí kèm nhận xét, trích dẫn đúng câu bị lỗi và mã lỗi tương ứng để hệ thống của bạn xử lý tiếp.",
        status: "stable",
        hasDemo: false,
        demoReady: false,
        endpoints: [
          {
            slug: "grade-task1",
            name: "Chấm bài Task 1",
            method: "POST",
            path: "/v1/ielts/writing/task1/grade",
            summary:
              "Chấm bài mô tả biểu đồ. Cần ảnh biểu đồ tải được, loại biểu đồ, đề bài và bài làm.",
          },
          {
            slug: "grade-task2",
            name: "Chấm bài Task 2",
            method: "POST",
            path: "/v1/ielts/writing/task2/grade",
            summary:
              "Chấm bài luận. Cần chủ đề, đề bài và bài làm — không cần ảnh.",
          },
        ],
      },
      {
        slug: "exercise-generation",
        name: "Tạo bài tập",
        tagline: "Sinh bài tập từ lỗi sai của học viên",
        description:
          "Nhận vào tiêu chí và mã lỗi cụ thể cùng vài bài mẫu tham chiếu, trả về bộ bài tập bám đúng lỗi đó. Dạng bài và số câu do mã lỗi quyết định, không cần chọn tay.",
        status: "stable",
        hasDemo: true,
        demoReady: true,
        endpoints: [
          {
            slug: "sample-references",
            name: "Lấy dữ liệu tham chiếu",
            method: "POST",
            path: "/external/micro-exercise/sample-references",
            summary:
              "Lấy ngẫu nhiên các bài làm thật có đúng mã lỗi cần luyện, dùng làm ngữ cảnh cho bước sinh bài tập.",
          },
          {
            slug: "create-micro-exercise",
            name: "Tạo bài tập nhỏ",
            method: "POST",
            path: "/create-micro-exercise",
            summary:
              "Sinh bài tập cho một mã lỗi đơn lẻ. Dạng bài và số câu suy ra từ mã lỗi.",
          },
          {
            slug: "create-longwriting-exercise",
            name: "Tạo bài tập đoạn văn",
            method: "POST",
            path: "/create-longwriting-exercise",
            summary:
              "Sinh một bài viết đoạn thân bài 50–100 từ khắc phục đồng thời nhiều lỗi thuộc các tiêu chí khác nhau.",
          },
        ],
      },
      {
        slug: "roadmap",
        name: "Tạo roadmap",
        tagline: "Dựng lộ trình luyện viết cá nhân hoá",
        description:
          "Từ lịch sử lỗi sai của học viên, đề xuất thứ tự kỹ năng cần luyện và bộ bài tập tương ứng cho từng giai đoạn.",
        status: "coming-soon",
        hasDemo: false,
        demoReady: false,
        endpoints: [],
      },
    ],
  },
  {
    slug: "ai-speaking",
    name: "Giải pháp AI Speaking",
    description:
      "Bộ API luyện và chấm IELTS Speaking — lấy câu hỏi theo Part, nhận audio và trả về transcript cùng phân tích theo rubric.",
    products: [
      {
        slug: "speaking",
        name: "Chấm Speaking",
        tagline: "Đánh giá câu trả lời IELTS qua audio",
        description:
          "Gửi câu hỏi và bản ghi âm để nhận transcript, độ liên quan, band ước tính và gợi ý cải thiện ngữ pháp, từ vựng, phát âm.",
        status: "stable",
        hasDemo: true,
        demoReady: true,
        endpoints: [
          {
            slug: "speaking-questions",
            name: "Lấy câu hỏi theo Part",
            method: "GET",
            path: "/v1/ielts/speaking/questions?part={part}",
            summary: "Lấy danh mục câu hỏi Speaking theo Part 1, 2 hoặc 3.",
          },
          {
            slug: "speaking-grading",
            name: "Chấm câu trả lời",
            method: "POST",
            path: "/v1/ielts/speaking/grading",
            summary:
              "Nhận audio và trả về transcript, band ước tính cùng feedback theo rubric.",
          },
        ],
      },
    ],
  },
];

export const ALL_PRODUCTS = API_CATEGORIES.flatMap((c) =>
  c.products.map((p) => ({ ...p, category: c }))
);

export function findProduct(slug: string) {
  return ALL_PRODUCTS.find((p) => p.slug === slug);
}
