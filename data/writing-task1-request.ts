/**
 * The chart AIHUB publishes for this example (aihub-be ADR-0060): a plain,
 * unsigned GET, because the grading service fetches it outside the caller's
 * request. The question and essay below describe this chart.
 */
export const WRITING_TASK1_SAMPLE_IMAGE_URL =
  "https://s3.wispace.app/ielts-task1/ca95bd4ab522946d";

export const WRITING_TASK1_REQUEST = {
  question:
    "The chart below shows the total number of minutes (in billions) of telephone calls in the UK, divided into three categories, from 1995-2002. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
  chart_type: "Bar Chart",
  image_url: WRITING_TASK1_SAMPLE_IMAGE_URL,
  essay:
    "The bar chart illustrates the total duration, measured in billions of minutes, of telephone calls made in the United Kingdom across three categories between 1995 and 2002.\n\nOverall, local fixed line calls were the most popular type throughout the entire period, although their share declined after 1999. In contrast, mobile calls grew steadily and consistently over the eight years.\n\nIn 1995, local fixed line calls accounted for approximately 72 billion minutes, which was considerably higher than national and international fixed line calls at around 38 billion minutes. Mobile calls were negligible at that point, standing at roughly 2 billion minutes.\n\nLocal fixed line usage rose to a peak of about 90 billion minutes in 1999, before falling back to approximately 72 billion minutes by 2002. Meanwhile, national and international calls increased gradually and reached around 61 billion minutes in the final year.\n\nMobile calls, despite starting from the lowest position, experienced the most dramatic growth, rising to about 46 billion minutes by 2002, a more than twentyfold increase.",
};

/** The API accepts exactly these, and the match is case-sensitive. */
export const WRITING_TASK1_CHART_TYPES = [
  "Bar Chart",
  "Line Graph",
  "Pie Chart",
  "Table",
  "Map",
  "Process Diagram",
  "Multiple Graphs",
] as const;

/**
 * Shared by the API reference and the Console, which both show this example.
 * An unreachable image is not a failure the caller can see: the grading service
 * fetches it, grades regardless, and returns a confident wrong result.
 */
export const WRITING_TASK1_IMAGE_NOTE =
  "image_url trong ví dụ trỏ tới biểu đồ mẫu AIHUB công bố, nên lệnh chạy được ngay. Khi chấm bài thật, thay bằng ảnh biểu đồ của bạn và đảm bảo dịch vụ chấm tải được ảnh đó: dịch vụ chấm không trả lỗi khi không tải được ảnh, nó vẫn chấm và trả kết quả, nên kết quả sẽ sai.";
