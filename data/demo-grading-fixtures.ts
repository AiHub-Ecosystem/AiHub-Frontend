import type { WritingGradingEnvelope } from "./scoring-response";
import type { SpeakingGradingEnvelope } from "./speaking-response";

const writingCriteria = (task: 1 | 2): WritingGradingEnvelope["data"]["criteria"] =>
  task === 1
    ? [
        { id: "task_achievement", name: "Task Achievement", band: 7, band_reason: "Overview rõ và chọn được các điểm chính.", strengths: ["So sánh được các xu hướng nổi bật."], improvements: ["Nêu thêm một mốc số liệu để hỗ trợ nhận xét."] },
        { id: "coherence_cohesion", name: "Coherence & Cohesion", band: 7, band_reason: "Bài có trình tự và chia đoạn hợp lý.", strengths: ["Các ý nối tiếp mạch lạc."], improvements: ["Dùng liên từ đa dạng hơn."] },
        { id: "lexical_resource", name: "Lexical Resource", band: 6.5, band_reason: "Từ vựng phù hợp với biểu đồ.", strengths: ["Có dùng từ chỉ xu hướng chính xác."], improvements: ["Hạn chế lặp lại các từ chỉ mức độ."] },
        { id: "grammatical_range_accuracy", name: "Grammatical Range & Accuracy", band: 6.5, band_reason: "Có câu ghép và một số cấu trúc phức.", strengths: ["Phần lớn câu dễ hiểu."], improvements: ["Rà lại mạo từ và hòa hợp chủ vị."] },
      ]
    : [
        { id: "task_response", name: "Task Response", band: 7, band_reason: "Bài trả lời đủ hai quan điểm và nêu ý kiến.", strengths: ["Lập trường được thể hiện rõ."], improvements: ["Phát triển thêm một ví dụ cụ thể."] },
        { id: "coherence_cohesion", name: "Coherence & Cohesion", band: 7, band_reason: "Các đoạn đi theo một mạch lập luận rõ.", strengths: ["Có đối chiếu giữa hai hướng đào tạo."], improvements: ["Tạo chuyển tiếp mềm hơn giữa các ý."] },
        { id: "lexical_resource", name: "Lexical Resource", band: 7, band_reason: "Từ vựng học thuật phù hợp chủ đề.", strengths: ["Dùng được các cụm từ tự nhiên."], improvements: ["Tránh lặp từ academic ở gần nhau."] },
        { id: "grammatical_range_accuracy", name: "Grammatical Range & Accuracy", band: 7, band_reason: "Có nhiều dạng câu với độ chính xác tốt.", strengths: ["Câu phức được kiểm soát tốt."], improvements: ["Rà lại dấu câu ở câu dài."] },
      ];

export const MOCK_WRITING_RESULTS: Record<1 | 2, WritingGradingEnvelope> = {
  1: {
    data: {
      overall_band: 7,
      language: "en",
      criteria: writingCriteria(1),
      summary: "Kết quả mẫu cố định cho Writing Task 1. Không được tạo từ bài vừa nhập.",
      suggestions: ["Làm rõ so sánh giữa ba nhóm số liệu."],
      next_steps: ["Luyện viết overview ngắn gọn trước khi nêu số liệu."],
      annotations: [
        { criterion: "task_achievement", issue: "sample_feedback", quote: "Mobile calls, despite starting from the lowest position", explanation: "Đây là ví dụ minh họa cách annotation trích một đoạn trong bài." },
      ],
    },
    meta: { request_id: "mock_writing_task_1", service: "writing", operation: "writing.task1.grade" },
  },
  2: {
    data: {
      overall_band: 7,
      language: "en",
      criteria: writingCriteria(2),
      summary: "Kết quả mẫu cố định cho Writing Task 2. Không được tạo từ bài vừa nhập.",
      suggestions: ["Bổ sung một ví dụ thực tế để củng cố lập luận."],
      next_steps: ["Luyện phát triển ví dụ theo luận điểm chính."],
      annotations: [
        { criterion: "task_response", issue: "sample_feedback", quote: "Neither path is complete alone", explanation: "Đây là ví dụ minh họa cách annotation trích một đoạn trong bài." },
      ],
    },
    meta: { request_id: "mock_writing_task_2", service: "writing", operation: "writing.task2.grade" },
  },
};

function speakingResult(
  part: 1 | 2 | 3,
  transcript: string,
  overall: number,
): SpeakingGradingEnvelope {
  return {
    data: {
      test_type: "Practice",
      question_id: `mock_speaking_part_${part}`,
      scorability: { is_scorable: true, confidence: "sample", display_band: true, message_vi: null },
      estimated_band: {
        overall,
        fluency_coherence: overall,
        lexical_resource: overall,
        grammatical_range_accuracy: overall,
        pronunciation: overall - 0.5,
      },
      transcript: {
        text: transcript,
        word_count: transcript.trim().split(/\s+/).length,
        duration_seconds: part === 1 ? 18 : part === 2 ? 42 : 25,
      },
      relevance: { on_topic: true, score: 0.92, feedback_vi: null },
      fluency_metrics: { speech_rate_wpm: 118, pause_count: 3, mean_length_run_words: 8 },
      pronunciation_detail: { summary: { good_count: 5, fair_count: 2, poor_count: 1 }, words: [] },
      language_analysis: {
        grammar_errors: [
          { sentence: transcript, error_segment: "a lot of", correction: "considerably", error_type: "word_choice", explanation_vi: "Có thể chọn từ trang trọng hơn trong ngữ cảnh này." },
        ],
        vocabulary_upgrades: [
          { original_word: "good", suggested_word: "rewarding", cefr_level: "B2", context: "sample", reason_vi: "Từ thay thế cụ thể hơn." },
        ],
      },
      feedback: {
        summary_vi: `Kết quả mẫu cố định cho Speaking Part ${part}. Không được tạo từ audio vừa gửi.`,
        strong_point_vi: "Câu trả lời bám chủ đề và có ví dụ.",
        action_plan_vi: "Thử dùng thêm câu nối và thay đổi nhịp nói.",
      },
    },
    meta: { request_id: `mock_speaking_part_${part}`, service: "speaking", operation: "speaking.grading" },
  };
}

export const MOCK_SPEAKING_RESULTS: Record<1 | 2 | 3, SpeakingGradingEnvelope> = {
  1: speakingResult(1, "I enjoy living in my hometown because it is friendly and convenient. I can meet my friends nearby, and there are many places to relax after work.", 7),
  2: speakingResult(2, "I would like to talk about a book that helped me manage my time. I read it last year, and its practical examples helped me organize my daily routine.", 7.5),
  3: speakingResult(3, "I agree that travel can broaden people's horizons. Meeting people with different customs helps us understand how culture shapes everyday life.", 7),
};
