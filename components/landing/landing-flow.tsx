import type { CSSProperties, ReactNode } from "react";

const ENDPOINTS: { method?: string; path: string }[] = [
  { method: "POST", path: "/v1/ielts/writing/task1/grade" },
  { method: "POST", path: "/v1/ielts/writing/task2/grade" },
  { method: "POST", path: "/v1/ielts/speaking/grading" },
  { method: "POST", path: "/v1/ielts/speaking/grading-json" },
  { path: "X-User-Identity" },
  { path: "Idempotency-Key · 24h" },
  { path: "28 mã lỗi · 7 dạng bài" },
];

const icon = (d: ReactNode) => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
);

const STEPS = [
  {
    title: "Bài nộp",
    field: "essay · audio",
    icon: icon(
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </>
    ),
  },
  {
    title: "Chấm 4 tiêu chí",
    field: "overall_band",
    icon: icon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />),
  },
  {
    title: "Bắt lỗi",
    field: "annotations",
    icon: icon(
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-5-5M8 11h6" />
      </>
    ),
  },
  {
    title: "Giải thích (vi)",
    field: "summary",
    icon: icon(
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />
    ),
  },
  {
    title: "Bài luyện",
    field: "next_steps",
    icon: icon(<path d="M5 12l5 5L20 7" />),
  },
];

const STATS = [
  { value: "13.404", label: "bài Writing thật đã chấm qua AiHub · Q3/2026" },
  { value: "28", label: "mã lỗi được nhận diện, gắn đúng câu sai" },
  { value: "≤ 60s", label: "thời gian xử lý tối đa mỗi bài Writing" },
];

const PAINS = [
  {
    tag: "GẤP",
    text: "47 bài Task 2 chưa chấm, hạn trả bài tối nay",
    pos: { left: "6%", top: 96 },
  },
  {
    tag: "LỆCH",
    text: "Cô A cho 6.0, thầy B cho 6.5 cùng một bài",
    pos: { right: "6%", top: 150 },
  },
  {
    tag: "HỎI",
    text: "“Sao em 5.5 mà bạn 6.0 ạ?” · 12 tin chưa đọc",
    pos: { left: "10%", top: 226 },
  },
  {
    tag: "TRỄ",
    text: "Nhận xét Speaking Part 2 dời sang tuần sau",
    pos: { right: "8%", top: 290 },
  },
  {
    tag: "GẤP",
    text: "Học viên cần bài luyện cho lỗi chủ–vị",
    pos: { left: "18%", top: 346 },
  },
];

const CALM = [
  "Nộp lúc 21:04 · có điểm lúc 21:05",
  "Cả lớp chấm trên cùng một thang đo",
  "Lỗi đã gắn mã · bài luyện sẵn sàng",
];

/** Heights of the "chấm tay" noise bars, one period of the scrolling strip. */
const NOISE = [
  10, 30, 50, 14, 70, 22, 38, 82, 18, 46, 10, 62, 30, 74, 18, 42, 10, 58, 26,
  78, 14, 50, 30, 66, 10,
];

function Ticks() {
  return (
    <>
      <span className="al-tick al-tl" />
      <span className="al-tick al-tr" />
      <span className="al-tick al-bl" />
      <span className="al-tick al-br" />
    </>
  );
}

export function EndpointStrip() {
  const chips = [...ENDPOINTS, ...ENDPOINTS];
  return (
    <section aria-label="Endpoint" className="al-strip">
      <div className="al-marq al-api al-muted">
        {chips.map((e, i) => (
          <span
            key={i}
            className="al-chip"
            aria-hidden={i >= ENDPOINTS.length || undefined}
          >
            {e.method && (
              <span style={{ color: "var(--al-mint)" }}>{e.method}</span>
            )}{" "}
            {e.path}
          </span>
        ))}
      </div>
    </section>
  );
}

export function Pipeline() {
  return (
    <section
      className="al-rv"
      aria-labelledby="pipe-h"
      style={{
        padding: "112px 24px 96px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 56,
      }}
    >
      <div className="al-head">
        <p className="al-eyebrow">Một request · năm bước</p>
        <h2 id="pipe-h" className="al-h2" style={{ maxWidth: 760 }}>
          Từ bài nộp đến bài luyện tiếp theo, trong một lần gọi
        </h2>
        <p className="al-lede" style={{ maxWidth: 600 }}>
          Bạn gửi bài làm. AiHub trả về điểm, lỗi, lời giải thích và hướng
          luyện, cùng một JSON.
        </p>
      </div>
      <div style={{ position: "relative", width: "100%", maxWidth: 920 }}>
        <div className="al-beam-line" aria-hidden="true" />
        <div className="al-beam" aria-hidden="true" />
        <ol className="al-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="al-step">
              <div
                className="al-node"
                style={{ animationDelay: `${-4.6 + i * 0.95}s` }}
              >
                {s.icon}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{s.title}</span>
              <span
                className="al-mono al-muted"
                style={{ fontSize: 11, lineHeight: "14px" }}
              >
                {s.field}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 16,
          width: "100%",
          maxWidth: 920,
        }}
      >
        {STATS.map((s) => (
          <div
            key={s.value}
            className="al-frame"
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span className="al-tick al-tl" />
            <span className="al-tick al-br" />
            <p
              style={{
                fontFamily: "var(--al-heading)",
                fontWeight: 700,
                fontSize: 32,
                lineHeight: "38px",
              }}
            >
              {s.value}
            </p>
            <p
              className="al-muted"
              style={{ fontSize: 13, lineHeight: "18px" }}
            >
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BeforeAfter() {
  const check = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
  return (
    <section
      className="al-rv"
      aria-labelledby="vs-h"
      style={{
        padding: "0 0 112px",
        display: "flex",
        flexDirection: "column",
        gap: 48,
      }}
    >
      <div className="al-head">
        <p className="al-eyebrow">Trước và sau AiHub</p>
        <h2 id="vs-h" className="al-h2">
          Ngừng chấm tay đến nửa đêm
        </h2>
      </div>
      <div className="al-vs">
        <Ticks />
        <div
          className="al-vs-side"
          style={{ borderRight: "1px solid var(--al-line)" }}
        >
          <h3 className="al-vs-title">Chấm tay</h3>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "46%",
              height: 90,
              overflow: "hidden",
              opacity: 0.55,
            }}
          >
            <div className="al-wave" style={{ animationDuration: "9s" }}>
              {[0, 1].map((k) => (
                <svg key={k} width="1200" height="90" viewBox="0 0 1200 90">
                  {[0, 300, 600, 900].map((x) =>
                    NOISE.map((h, i) => (
                      <rect
                        key={`${x}-${i}`}
                        x={x + i * 12}
                        y={45 - h / 2}
                        width="3"
                        height={h}
                        fill="#F5C77E"
                      />
                    ))
                  )}
                </svg>
              ))}
            </div>
          </div>
          <ul>
            {PAINS.map((p, i) => (
              <li
                key={i}
                className="al-pile"
                style={{
                  ...(p.pos as CSSProperties),
                  animationDelay: `${i * 0.9}s`,
                }}
              >
                <div className="al-toast">
                  <span className="al-chip-hot">{p.tag}</span>
                  <span>{p.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="al-vs-side al-halftone">
          <div
            className="al-sun2"
            aria-hidden="true"
            style={{ bottom: -240 }}
          />
          <h3 className="al-vs-title" style={{ color: "#FFFFFF" }}>
            Chấm với AiHub
          </h3>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "50%",
              height: 1,
              borderTop: "1px dashed rgba(255,255,255,.35)",
            }}
          />
          <ul className="al-calm-box">
            {CALM.map((t, i) => (
              <li
                key={t}
                className="al-calm"
                style={{ animationDelay: `${i * 3}s` }}
              >
                <div className="al-calm-card">
                  {check}
                  {t}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
