import type { CSSProperties } from "react";

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

const LOG = [
  { code: 200, path: "writing/task2/grade", time: "8,1s" },
  { code: 200, path: "speaking/grading", time: "14,2s" },
  { code: 200, path: "writing/task1/grade", time: "9,4s" },
  { code: 429, path: "writing/task2/grade", time: "retry 800ms" },
  { code: 200, path: "writing/task2/grade", time: "7,8s" },
  { code: 200, path: "speaking/grading-json", time: "12,0s" },
  { code: 200, path: "writing/task2/grade", time: "8,6s" },
  { code: 200, path: "writing/task1/grade", time: "9,1s" },
];

const FIXES = [
  {
    tag: "GRA",
    text: "thinks → think",
    why: "Chủ ngữ số nhiều đi với động từ nguyên mẫu.",
  },
  { tag: "LR", text: "make a research → do research" },
  { tag: "GRA", text: "am agree → agree" },
];

const SPOKEN = [
  "I",
  "would",
  "like",
  "to",
  "describe",
  "a",
  "teacher",
  "who",
  "inspired",
  "me…",
];
const SPEAKING_BANDS = [
  ["FC", "6.5"],
  ["LR", "6.0"],
  ["GRA", "6.0"],
  ["P", "6.5"],
];
/** One period of the speaking waveform; drawn twice so the marquee loops. */
const WAVE = [
  10, 30, 46, 18, 54, 26, 38, 10, 50, 22, 42, 14, 58, 30, 10, 38, 22, 50, 14,
  34, 46, 18, 54, 26, 10,
];

export function LiveDemo() {
  return (
    <section id="demo" className="al-rv al-section" aria-labelledby="bento-h">
      <div className="al-head">
        <p className="al-eyebrow">Demo sống</p>
        <h2 id="bento-h" className="al-h2">
          Xem AiHub đang làm việc
        </h2>
      </div>
      <div className="al-bento">
        <ErrorCard />
        <RequestLog />
        <SpeakingCard />
        <ExerciseCard />
      </div>
    </section>
  );
}

function ErrorCard() {
  return (
    <div className="al-panel al-lift al-span2 al-card" style={{ gap: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h3 style={{ fontSize: 22, lineHeight: "28px" }}>
            Bắt lỗi ngay trên câu viết
          </h3>
          <p className="al-muted" style={{ fontSize: 14, lineHeight: "20px" }}>
            Mỗi lỗi có vị trí, mã tiêu chí và cách sửa.
          </p>
        </div>
        <span
          className="al-pop"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "var(--al-bg)",
            border: "1px solid var(--al-line)",
            borderRadius: 999,
            padding: "6px 14px",
          }}
        >
          <span className="al-mono al-muted" style={{ fontSize: 12 }}>
            overall_band
          </span>
          <strong style={{ fontFamily: "var(--al-heading)", fontSize: 18 }}>
            6.5
          </strong>
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        <p style={{ flex: "1 1 380px", fontSize: 18, lineHeight: "34px" }}>
          Nowadays, many people{" "}
          <span className="al-hl" style={delay(0.6)}>
            thinks
          </span>{" "}
          that university education should be free. Governments could{" "}
          <span className="al-hl" style={delay(1.3)}>
            make a research
          </span>{" "}
          on which subjects the economy needs most. In conclusion, I{" "}
          <span className="al-hl" style={delay(2)}>
            am agree
          </span>{" "}
          that free tuition brings more benefits.
        </p>
        <ul
          style={{
            flex: "1 1 240px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {FIXES.map((f, i) => (
            <li
              key={f.text}
              className="al-fix al-fu"
              style={delay(0.8 + i * 0.7)}
            >
              <span className="al-badge al-b-beta">{f.tag}</span>{" "}
              <span className="al-mono" style={{ fontSize: 12 }}>
                {f.text}
              </span>
              {f.why && (
                <p
                  className="al-muted"
                  style={{ fontSize: 13, lineHeight: "18px", marginTop: 6 }}
                >
                  {f.why}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="al-muted" style={{ fontSize: 12, lineHeight: "16px" }}>
        Bài mẫu minh hoạ, không phải kết quả chấm thật.
      </p>
    </div>
  );
}

function RequestLog() {
  return (
    <div className="al-panel al-lift al-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ fontSize: 20, lineHeight: "26px" }}>Request log</h3>
        <span
          className="al-mono al-muted"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
          }}
        >
          <span className="al-pulse" />
          live
        </span>
      </div>
      <div
        className="al-mask-y"
        style={{ height: 240, overflow: "hidden", position: "relative" }}
      >
        <div
          className="al-logrun al-mono"
          style={{ gap: 10, fontSize: 12, lineHeight: "16px" }}
        >
          {[...LOG, ...LOG].map((l, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
              aria-hidden={i >= LOG.length || undefined}
            >
              <span>
                <span
                  style={{
                    color:
                      l.code === 200 ? "var(--al-mint)" : "var(--al-amber)",
                  }}
                >
                  {l.code}
                </span>{" "}
                {l.path}
              </span>
              <span className="al-muted">{l.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SpeakingCard() {
  return (
    <div
      className="al-panel al-lift al-halftone al-card"
      style={{ borderColor: "#5B5FEF", overflow: "hidden" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ fontSize: 20, lineHeight: "26px", color: "#FFFFFF" }}>
          Speaking Part 2
        </h3>
        <span className="al-badge al-b-beta">Beta</span>
      </div>
      <div
        aria-hidden="true"
        style={{
          height: 70,
          overflow: "hidden",
          borderRadius: 12,
          background: "rgba(20,21,43,.3)",
        }}
      >
        <div className="al-wave">
          {[0, 1].map((k) => (
            <svg key={k} width="600" height="70" viewBox="0 0 600 70">
              {[0, 300].map((x) =>
                WAVE.map((h, i) => (
                  <rect
                    key={`${x}-${i}`}
                    x={x + 4 + i * 12}
                    y={35 - h / 2}
                    width="4"
                    height={h}
                    rx="2"
                    fill="#FFFFFF"
                  />
                ))
              )}
            </svg>
          ))}
        </div>
      </div>
      <p
        style={{
          fontSize: 16,
          lineHeight: "26px",
          color: "rgba(255,255,255,.6)",
        }}
      >
        {SPOKEN.map((w, i) => (
          <span key={i}>
            <span className="al-word" style={delay(0.4 + i * 0.4)}>
              {w}
            </span>{" "}
          </span>
        ))}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,minmax(0,1fr))",
          gap: 8,
        }}
      >
        {SPEAKING_BANDS.map(([k, v]) => (
          <div key={k} className="al-score">
            <span
              className="al-mono"
              style={{
                fontSize: 10,
                lineHeight: "14px",
                color: "var(--al-tint)",
              }}
            >
              {k}
            </span>
            <strong
              style={{ fontSize: 18, lineHeight: "22px", color: "#FFFFFF" }}
            >
              {v}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExerciseCard() {
  return (
    <div className="al-panel al-lift al-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ fontSize: 20, lineHeight: "26px" }}>
          Sinh bài luyện từ lỗi
        </h3>
        <span className="al-badge al-b-stable">Stable</span>
      </div>
      <div style={{ position: "relative", height: 200 }}>
        <div
          className="al-gen-a"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          <span className="al-mono al-muted" style={{ fontSize: 12 }}>
            error_code: GRA.subject_verb
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
            }}
          >
            Đang sinh 3 bài luyện <span className="al-dot" />
            <span className="al-dot" style={delay(0.15)} />
            <span className="al-dot" style={delay(0.3)} />
          </span>
        </div>
        <div
          className="al-gen-b"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <span
            className="al-mono"
            style={{ fontSize: 11, color: "var(--al-focus)" }}
          >
            Bài 1/3 · Tìm lỗi
          </span>
          <p style={{ fontSize: 16, lineHeight: "24px" }}>
            “Many people{" "}
            <u style={{ textDecorationColor: "var(--al-focus)" }}>thinks</u>{" "}
            that university should be free.”
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span className="al-opt">thinks</span>
            <span
              className="al-opt"
              style={{
                borderColor: "var(--al-focus)",
                background: "rgba(139,142,245,.15)",
              }}
            >
              think ✓
            </span>
            <span className="al-opt">thinking</span>
          </div>
        </div>
      </div>
      <p className="al-muted" style={{ fontSize: 12, lineHeight: "16px" }}>
        Trắc nghiệm · điền từ · sắp xếp câu · tìm lỗi · viết lại câu
      </p>
    </div>
  );
}
