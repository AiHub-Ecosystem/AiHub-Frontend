import { BarChart3, Check, FileText, KeyRound, Send } from "lucide-react";

/** The overview teaches the header contract the demo itself cannot show. */
const INTEGRATION_STEPS = [
  {
    step: "1",
    title: "Ứng dụng của bạn",
    body: "Nhận bài làm của người học từ form hoặc tệp của bạn.",
    icon: FileText,
  },
  {
    step: "2",
    title: "Server của bạn",
    body: "Giữ API key và User Identity. Không gọi thẳng từ trình duyệt.",
    icon: KeyRound,
  },
  {
    step: "3",
    title: "Gửi kèm Idempotency-Key",
    // The two tasks have disjoint bodies, so the step names both rather than
    // describing whichever task happens to be open.
    body: "Task 1 gửi question, essay, chart_type và image_url. Task 2 gửi question, essay và topic.",
    icon: Send,
  },
  {
    step: "4",
    title: "AIHUB chấm bài",
    body: "Chấm theo 4 tiêu chí IELTS.",
    icon: BarChart3,
  },
  {
    step: "5",
    title: "Báo cáo về hệ thống",
    body: "Nhận overall_band, criteria, annotations, suggestions và next_steps.",
    icon: Check,
  },
];

export function Overview({ task }: { task: 1 | 2 }) {
  return (
    <section className="scoring-overview" aria-label="Các bước tích hợp">
      <div className="scoring-overview-copy">
        <p className="eyebrow">Tổng quan tích hợp</p>
        <h1>
          Chấm điểm bài viết IELTS theo 4 tiêu chí, gọi thẳng API của AIHUB
        </h1>
        <p className="scoring-endpoint">
          <span className="method">POST</span>
          <code>/v1/ielts/writing/task{task}/grade</code>
        </p>
        <p className="scoring-overview-lede">
          Bài làm được chấm bởi dịch vụ thật. Điểm về theo đúng bốn tiêu chí{" "}
          {task === 1 ? "Task Achievement" : "Task Response"}, Coherence &amp;
          Cohesion, Lexical Resource và Grammatical Range &amp; Accuracy, kèm
          trích dẫn nguyên văn những chỗ cần sửa.
        </p>
      </div>
      <ol className="scoring-flow">
        {INTEGRATION_STEPS.map((item) => {
          const Icon = item.icon;
          return (
            <li className="scoring-flow-step" key={item.step}>
              <span className="scoring-flow-num">{item.step}</span>
              <span className="scoring-flow-text">
                <strong>
                  <Icon size={12} /> {item.title}
                </strong>
                <span>{item.body}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
