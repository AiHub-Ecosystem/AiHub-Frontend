import Link from "next/link";
import type { CSSProperties } from "react";

const ROTATING = [
  "Writing Task 2",
  "Speaking Part 2",
  "Task 1 biểu đồ",
  "cả lớp IELTS",
  "Writing Task 2",
];

const RECENT = [
  { name: "Writing T2", status: "200 · 8,1s", ok: true },
  { name: "Speaking P2", status: "200 · 14s", ok: true },
  { name: "Writing T1", status: "200 · 9,4s", ok: true },
  { name: "Writing T2", status: "429 · retry", ok: false },
  { name: "Speaking P1", status: "200 · 11s", ok: true },
];

const BARS = [
  { h: 38, c: "#C7C7D9" },
  { h: 52, c: "#C7C7D9" },
  { h: 45, c: "#C7C7D9" },
  { h: 70, c: "#8B8EF5" },
  { h: 62, c: "#8B8EF5" },
  { h: 84, c: "#5B5FEF" },
  { h: 100, c: "#5B5FEF" },
];

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });
const heading: CSSProperties = {
  fontFamily: "var(--al-heading)",
  fontWeight: 700,
};

export function LandingHero() {
  return (
    <section style={{ padding: "24px 24px 0" }}>
      <div className="al-hero al-halftone">
        <div className="al-sun" aria-hidden="true" />
        <div className="al-sun2" aria-hidden="true" />
        <div className="al-hero-inner">
          <div className="al-hero-copy">
            <span className="al-hero-pill al-fu">
              <span className="al-pulse" style={{ background: "#FFFFFF" }} />
              Speaking BETA đã mở · Writing STABLE
            </span>
            <h1 className="al-hero-title al-fu" style={delay(0.1)}>
              Chấm{" "}
              <span className="al-rot" aria-hidden="true">
                <span className="al-rot-in">
                  {ROTATING.map((t, i) => (
                    <span key={i}>{t}</span>
                  ))}
                </span>
              </span>
              <span
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                  clip: "rect(0 0 0 0)",
                }}
              >
                bài IELTS Writing và Speaking
              </span>
              <br />
              chuẩn giám khảo, ngay trong ứng dụng của bạn
            </h1>
            <p className="al-hero-sub al-fu" style={delay(0.2)}>
              Band 4 tiêu chí, câu sai có mã lỗi, giải thích tiếng Việt và bài
              luyện tiếp theo. Một API key, một HTTP request.
            </p>
            <div
              className="al-fu"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                ...delay(0.3),
              }}
            >
              <Link href="/register" className="al-btn al-btn-white">
                Bắt đầu miễn phí →
              </Link>
              <Link href="/demo" className="al-btn al-btn-glass">
                Xem demo trực tiếp
              </Link>
            </div>
            <p className="al-hero-note al-mono al-fu" style={delay(0.4)}>
              25 lượt chấm sandbox miễn phí · không cần thẻ
            </p>
          </div>
          <div className="al-stage-wrap al-fu" style={delay(0.3)}>
            <div className="al-stage-box">
              <HeroStage />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStage() {
  return (
    <div
      className="al-stage"
      role="img"
      aria-label="Giáo viên bên cạnh AiHub Console trên laptop và dashboard request trên điện thoại"
    >
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 70,
          width: 440,
          height: 440,
          borderRadius: 999,
          background:
            "radial-gradient(circle,rgba(237,235,254,.95) 0%,rgba(237,235,254,.55) 55%,rgba(237,235,254,0) 72%)",
        }}
      />
      <div
        className="al-spin"
        style={{
          position: "absolute",
          left: 40,
          top: 50,
          width: 480,
          height: 480,
          borderRadius: 999,
          border: "1px dashed rgba(255,255,255,.35)",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative art inside a scaled stage; next/image sizing would fight the transform */}
      <img
        src="/assets/landing/hero-teacher.webp"
        alt=""
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 540,
          height: "auto",
        }}
      />
      <svg
        aria-hidden="true"
        width="64"
        height="64"
        viewBox="0 0 64 64"
        fill="none"
        style={{ position: "absolute", left: 96, top: 48 }}
      >
        <path
          className="al-draw-s"
          d="M10 40l10-18M28 34l4-22M44 38l12-14"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <Laptop />
      <Phone />
      <div
        className="al-pop"
        style={{ position: "absolute", left: 446, top: 118, ...delay(2.6) }}
      >
        <div
          className="al-float"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,.92)",
            border: "1px solid #E4E4EC",
            borderRadius: 999,
            padding: "8px 14px 8px 8px",
            boxShadow: "0 12px 32px rgba(20,21,43,.25)",
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              background: "#5B5FEF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12l5 5L20 7" />
            </svg>
          </span>
          <span
            style={{
              fontSize: 12,
              lineHeight: "16px",
              fontWeight: 600,
              color: "#14152B",
            }}
          >
            Bài mới đã chấm ·{" "}
            <span className="al-mono" style={{ color: "#4547C9" }}>
              6.5
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Laptop() {
  const nav = ["API keys", "Lượt dùng", "Playground", "Thanh toán"];
  const stats = [
    ["Bài đã chấm · 30 ngày", "1.284"],
    ["Band trung bình lớp", "6.0"],
    ["Credit còn lại", "72%"],
  ];
  const line =
    "M0 70 L20 62 L40 64 L60 50 L80 54 L100 40 L120 44 L140 30 L160 34 L180 20 L200 24 L220 10";
  return (
    <div
      style={{
        position: "absolute",
        left: 258,
        top: 212,
        width: 430,
        transform: "scale(.9)",
        transformOrigin: "top left",
      }}
    >
      <div
        style={{
          background: "#0B0C1C",
          borderRadius: "16px 16px 6px 6px",
          padding: 8,
          boxShadow: "0 24px 60px rgba(10,10,30,.45)",
        }}
      >
        <div
          className="al-ui"
          style={{
            background: "#FFFFFF",
            borderRadius: 8,
            height: 254,
            display: "flex",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: 82,
              flex: "none",
              background: "#F7F7FB",
              borderRight: "1px solid #E4E4EC",
              padding: "10px 8px",
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: "#5B5FEF",
                }}
              />
              <span style={{ ...heading, fontSize: 10 }}>AiHub</span>
            </div>
            <span
              style={{
                fontSize: 8,
                lineHeight: "12px",
                fontWeight: 600,
                background: "#EDEBFE",
                color: "#4547C9",
                borderRadius: 4,
                padding: "2px 5px",
              }}
            >
              Tổng quan
            </span>
            {nav.map((n) => (
              <span
                key={n}
                style={{
                  fontSize: 8,
                  lineHeight: "12px",
                  color: "#5C5D77",
                  padding: "2px 5px",
                }}
              >
                {n}
              </span>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <p style={{ ...heading, fontSize: 12, lineHeight: "16px" }}>
                Chào buổi sáng, cô Mai
              </p>
              <span
                className="al-mono"
                style={{
                  fontSize: 7,
                  fontWeight: 600,
                  letterSpacing: ".06em",
                  background: "#0F6B4C",
                  color: "#FFFFFF",
                  borderRadius: 999,
                  padding: "2px 6px",
                }}
              >
                PRODUCTION
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,minmax(0,1fr))",
                gap: 6,
              }}
            >
              {stats.map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    border: "1px solid #E4E4EC",
                    borderRadius: 6,
                    padding: 6,
                  }}
                >
                  <p
                    style={{
                      fontSize: 7,
                      lineHeight: "10px",
                      color: "#5C5D77",
                    }}
                  >
                    {label}
                  </p>
                  <p style={{ ...heading, fontSize: 13, lineHeight: "18px" }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div
              style={{
                flex: 1,
                border: "1px solid #E4E4EC",
                borderRadius: 6,
                padding: 6,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                minHeight: 0,
              }}
            >
              <p style={{ fontSize: 7, lineHeight: "10px", fontWeight: 600 }}>
                Lượt chấm theo ngày
              </p>
              <svg
                viewBox="0 0 220 80"
                width="100%"
                height="84"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d={`${line} L220 80 L0 80 Z`}
                  fill="#EDEBFE"
                  className="al-ln"
                  style={delay(1.8)}
                />
                <path
                  className="al-draw"
                  d={line}
                  fill="none"
                  stroke="#5B5FEF"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div
              className="al-mono"
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid #E4E4EC",
                paddingTop: 6,
                fontSize: 7,
                lineHeight: "10px",
                color: "#5C5D77",
              }}
            >
              <span>
                <span style={{ color: "#0F6B4C" }}>POST</span>{" "}
                /v1/ielts/writing/task2/grade
              </span>
              <span>200 · band 6.5</span>
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          height: 12,
          margin: "0 -24px",
          background: "#C7C7D9",
          borderRadius: "0 0 14px 14px",
        }}
      />
    </div>
  );
}

function Phone() {
  return (
    <div
      className="al-float"
      style={{
        position: "absolute",
        left: 488,
        top: 262,
        width: 150,
        ...delay(0.5),
      }}
    >
      <div
        style={{
          background: "#0B0C1C",
          borderRadius: 26,
          padding: 6,
          boxShadow: "0 24px 60px rgba(10,10,30,.5)",
        }}
      >
        <div
          className="al-ui"
          style={{
            background: "#FFFFFF",
            borderRadius: 20,
            height: 292,
            padding: "10px 10px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 7,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: 40,
              height: 5,
              borderRadius: 999,
              background: "#14152B",
              alignSelf: "center",
            }}
          />
          <p
            style={{
              fontSize: 8,
              lineHeight: "12px",
              color: "#5C5D77",
              marginTop: 2,
            }}
          >
            Request hôm nay
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <p
              className="al-pop"
              style={{
                ...heading,
                fontSize: 24,
                lineHeight: "28px",
                ...delay(1),
              }}
            >
              842
            </p>
            <span style={{ fontSize: 8, fontWeight: 600, color: "#0F6B4C" }}>
              99,6% OK
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 5,
              height: 56,
              padding: "4px 0",
              borderBottom: "1px solid #E4E4EC",
            }}
            aria-hidden="true"
          >
            {BARS.map((b, i) => (
              <div
                key={i}
                className="al-grow"
                style={{
                  flex: 1,
                  height: `${b.h}%`,
                  background: b.c,
                  borderRadius: "3px 3px 0 0",
                  ...delay(1.1 + i * 0.1),
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: 8, lineHeight: "12px", fontWeight: 600 }}>
            Gần đây
          </p>
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <div
              className="al-logrun"
              style={{
                gap: 5,
                fontSize: 7.5,
                lineHeight: "10px",
                animationDuration: "12s",
              }}
            >
              {[...RECENT, ...RECENT].map((r, i) => (
                <div
                  key={i}
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>{r.name}</span>
                  <span
                    className="al-mono"
                    style={{ color: r.ok ? "#0F6B4C" : "#9A3D00" }}
                  >
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
