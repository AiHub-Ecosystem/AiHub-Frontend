"use client";

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";

const ROTATE_MS = 6000;

type Product = {
  id: string;
  name: string;
  sub: string;
  badge: string;
  badgeCls: string;
  panel: ReactNode;
};

const WRITING_BANDS = [
  ["Task Response", "7.0", 78],
  ["Coherence", "6.5", 72],
  ["Lexical", "6.5", 72],
  ["Grammar", "6.0", 66],
] as const;

const bigNumber = {
  fontFamily: "var(--al-heading)",
  fontWeight: 700,
  fontSize: 28,
  lineHeight: "34px",
} as const;

function Copy({
  title,
  body,
  api,
  apiMuted,
}: {
  title: string;
  body: string;
  api: ReactNode;
  apiMuted?: boolean;
}) {
  return (
    <div
      style={{
        flex: "1 1 260px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <h3 style={{ fontSize: 28, lineHeight: "34px" }}>{title}</h3>
      <p className="al-muted" style={{ fontSize: 16, lineHeight: "24px" }}>
        {body}
      </p>
      <p className={apiMuted ? "al-api al-muted" : "al-api"}>{api}</p>
    </div>
  );
}

const PRODUCTS: Product[] = [
  {
    id: "writing",
    name: "Chấm Writing",
    sub: "Task 1 & Task 2 · 4 tiêu chí",
    badge: "Stable",
    badgeCls: "al-b-stable",
    panel: (
      <>
        <Copy
          title="Chấm Writing"
          body="Task 1 với 7 dạng biểu đồ và Task 2. Band 0–9 theo bước 0.5, luôn đủ 4 tiêu chí theo thứ tự cố định."
          api={
            <>
              POST /v1/ielts/writing/task1/grade
              <br />
              POST /v1/ielts/writing/task2/grade
            </>
          }
        />
        <div
          style={{
            flex: "1 1 260px",
            display: "grid",
            gridTemplateColumns: "repeat(2,minmax(0,1fr))",
            gap: 10,
          }}
        >
          {WRITING_BANDS.map(([label, band, pct], i) => (
            <div key={label} className="al-panel" style={{ padding: 16 }}>
              <span className="al-mono al-muted" style={{ fontSize: 11 }}>
                {label}
              </span>
              <p style={bigNumber}>{band}</p>
              <div
                style={{
                  height: 4,
                  background: "var(--al-line)",
                  borderRadius: 2,
                }}
              >
                <div
                  className="al-bar"
                  style={{
                    height: 4,
                    width: `${pct}%`,
                    background: "var(--al-focus)",
                    borderRadius: 2,
                    animationDuration: `${1 + i * 0.1}s`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: "speaking",
    name: "Chấm Speaking",
    sub: "Part 1, 2, 3 · transcript & phát âm",
    badge: "Beta",
    badgeCls: "al-b-beta",
    panel: (
      <>
        <Copy
          title="Chấm Speaking"
          body="Part 1, 2, 3. Transcript, độ lưu loát, phát âm và band ước lượng theo từng tiêu chí. Nhận file wav, mp3, m4a, webm, ogg."
          api={
            <>
              POST /v1/ielts/speaking/grading
              <br />
              POST /v1/ielts/speaking/grading-json
            </>
          }
        />
        <div
          style={{
            flex: "1 1 260px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            className="al-panel"
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span className="al-mono al-muted" style={{ fontSize: 11 }}>
              fluency_metrics
            </span>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
              }}
            >
              <span>Tốc độ nói</span>
              <strong>128 từ/phút</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
              }}
            >
              <span>Ngắt quãng dài</span>
              <strong>3 lần</strong>
            </div>
          </div>
          <div
            className="al-panel"
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span className="al-mono al-muted" style={{ fontSize: 11 }}>
              pronunciation_detail
            </span>
            <p style={{ fontSize: 14, lineHeight: "20px" }}>
              “inspired” · nhấn âm sai vị trí
            </p>
          </div>
          <p className="al-muted" style={{ fontSize: 12 }}>
            Số liệu minh hoạ.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "exercise",
    name: "Tạo bài tập",
    sub: "Từ câu sai của học viên",
    badge: "Stable",
    badgeCls: "al-b-stable",
    panel: (
      <>
        <Copy
          title="Tạo bài tập"
          body="Sinh bài luyện từ chính câu sai của học viên. Dạng bài và số lượng do mã lỗi quyết định, mỗi bài có gợi ý, đáp án và lời giải."
          api="28 mã lỗi · 7 dạng bài · rubric 1–10 cho viết lại câu"
        />
        <div
          style={{
            flex: "1 1 260px",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignContent: "center",
          }}
        >
          {[
            "Trắc nghiệm",
            "Điền từ",
            "Sắp xếp câu",
            "Tìm lỗi",
            "Viết lại câu",
          ].map((t) => (
            <span
              key={t}
              className="al-panel al-pill"
              style={
                t === "Tìm lỗi" ? { borderColor: "var(--al-focus)" } : undefined
              }
            >
              {t}
            </span>
          ))}
        </div>
      </>
    ),
  },
  {
    id: "roadmap",
    name: "Tạo lộ trình",
    sub: "Từ lịch sử lỗi",
    badge: "Soon",
    badgeCls: "al-b-soon",
    panel: (
      <>
        <Copy
          title="Tạo lộ trình"
          body="Lộ trình Writing cá nhân hoá từ lịch sử lỗi của từng học viên."
          api="Chưa công bố endpoint"
          apiMuted
        />
        <ol
          style={{
            flex: "1 1 260px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {[
            "Hoà hợp chủ – vị",
            "Collocation với do / make",
            "Mạch lạc giữa các đoạn",
          ].map((t, i) => (
            <li
              key={t}
              className="al-panel"
              style={{
                padding: "14px 16px",
                display: "flex",
                gap: 12,
                alignItems: "center",
                opacity: [1, 0.7, 0.45][i],
              }}
            >
              <span className="al-mono" style={{ color: "var(--al-focus)" }}>
                0{i + 1}
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </>
    ),
  },
];

/** Product catalog: auto-advances every 6s until paused; arrow keys move between tabs. */
export function ProductTabs() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // Bumped on every manual pick so the timer and the progress bar restart from zero.
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const id = window.setInterval(
      () => setActive((a) => (a + 1) % PRODUCTS.length),
      ROTATE_MS
    );
    return () => window.clearInterval(id);
  }, [paused, cycle]);

  const pick = (i: number) => {
    setActive(i);
    setCycle((c) => c + 1);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = (active + step + PRODUCTS.length) % PRODUCTS.length;
    pick(next);
    document.getElementById(`al-ptab-${PRODUCTS[next].id}`)?.focus();
  };

  const current = PRODUCTS[active];
  return (
    <section
      id="san-pham"
      className="al-rv al-section"
      aria-labelledby="prod-h"
    >
      <div className="al-head">
        <p className="al-eyebrow">Danh mục API</p>
        <h2 id="prod-h" className="al-h2">
          Một API key cho cả vòng chấm → sửa → luyện
        </h2>
      </div>
      <div className="al-frame" style={{ display: "flex", flexWrap: "wrap" }}>
        <span className="al-tick al-tl" />
        <span className="al-tick al-tr" />
        <span className="al-tick al-bl" />
        <span className="al-tick al-br" />
        <div
          style={{
            flex: "1 1 260px",
            minWidth: 0,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            borderRight: "1px solid var(--al-line)",
          }}
        >
          <div
            role="tablist"
            aria-label="Sản phẩm"
            aria-orientation="vertical"
            onKeyDown={onKey}
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            {PRODUCTS.map((p, i) => (
              <button
                key={p.id}
                id={`al-ptab-${p.id}`}
                type="button"
                role="tab"
                className="al-ptab"
                aria-selected={i === active}
                aria-controls="al-ppanel"
                tabIndex={i === active ? 0 : -1}
                onClick={() => pick(i)}
              >
                <span
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                  }}
                >
                  {p.name}
                  <span className={`al-badge ${p.badgeCls}`}>{p.badge}</span>
                </span>
                <span
                  style={{
                    fontSize: 13,
                    lineHeight: "18px",
                    fontWeight: 400,
                    color: "var(--al-muted)",
                  }}
                >
                  {p.sub}
                </span>
                {i === active && !paused && (
                  <span
                    key={`${active}-${cycle}`}
                    className="al-prog"
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="al-btn al-btn-line al-btn-sm"
            onClick={() => {
              setPaused((p) => !p);
              setCycle((c) => c + 1);
            }}
            style={{ marginTop: 8, alignSelf: "flex-start", fontSize: 12 }}
            aria-label={
              paused
                ? "Tiếp tục tự chuyển sản phẩm"
                : "Tạm dừng tự chuyển sản phẩm"
            }
          >
            {paused ? "▶ Tự chạy" : "❚❚ Tạm dừng"}
          </button>
        </div>
        <div
          id="al-ppanel"
          role="tabpanel"
          aria-labelledby={`al-ptab-${current.id}`}
          style={{
            flex: "2.2 1 520px",
            minWidth: 0,
            padding: 32,
            minHeight: 380,
            display: "flex",
          }}
        >
          <div
            key={current.id}
            className="al-fu"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 32,
              width: "100%",
              alignItems: "center",
            }}
          >
            {current.panel}
          </div>
        </div>
      </div>
    </section>
  );
}
