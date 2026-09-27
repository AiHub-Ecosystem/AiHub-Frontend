export const WRITING_TASK1_REQUEST = {
  question:
    "The chart below shows the estimated oil production capacity of several countries in 2010. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
  chart_type: "Bar Chart",
  image_url: "https://example.com/ielts-task1/oil-production-chart.png",
  essay:
    "The bar chart illustrates the estimated oil production capacity of four countries in 2010, showing a big increase of production in the two largest producers. Saudi Arabia led the group at roughly 10 million barrels per day, almost three times the figure for Russia. Norway and Mexico produced were considerably less, at about 1.6 and 2.5 million barrels respectively. Overall, oil production was heavily concentrated in a small number of countries.",
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
 * Shared by the API reference and the Console, which both show this example. An
 * unreachable image is not a failure the caller can see: the grading service
 * fetches it, grades regardless, and returns a confident wrong result.
 */
export const WRITING_TASK1_IMAGE_PLACEHOLDER_NOTE =
  "image_url trong ví dụ là URL giữ chỗ — thay bằng ảnh biểu đồ thật mà dịch vụ chấm truy cập được";
