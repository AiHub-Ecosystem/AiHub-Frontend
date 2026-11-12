import Link from "next/link";
import { LandingLogo } from "./landing-nav";

const PLANS = [
  {
    name: "Sandbox",
    who: "để thử nghiệm",
    price: "0 ₫",
    unit: "",
    tags: ["25 lượt / tháng", "Writing", "Không cần thẻ"],
    cta: { label: "Lấy key sandbox", href: "/register", cls: "al-btn-line" },
  },
  {
    name: "Theo lượt",
    who: "cho EdTech & trung tâm",
    // Giá chưa chốt: để placeholder thay vì bịa một con số.
    price: "[GIÁ] ₫",
    unit: "/ bài Writing",
    tags: ["[GIÁ] ₫ / phút Speaking", "Nạp QR", "Hoá đơn điện tử"],
    cta: { label: "Bắt đầu", href: "/register", cls: "al-btn-primary" },
    hot: true,
  },
  {
    name: "Doanh nghiệp",
    who: "cho chuỗi trung tâm",
    price: "Liên hệ",
    unit: "",
    tags: ["SLA", "Rubric riêng", "JWT ký số"],
    cta: { label: "Đặt lịch trao đổi", href: "/contact", cls: "al-btn-line" },
  },
];

const FOOTER = [
  {
    title: "Sản phẩm",
    links: [
      ["Chấm Writing", "/product"],
      ["Chấm Speaking", "/product"],
      ["Tạo bài tập", "/product/exercise-generation"],
      ["Demo", "/demo"],
    ],
  },
  {
    title: "Tài nguyên",
    links: [
      ["Hướng dẫn tích hợp", "/docs"],
      ["API reference", "/product"],
      ["Bảng giá", "/pricing"],
    ],
  },
  {
    title: "Công ty",
    links: [
      ["Giới thiệu", "/about"],
      ["Liên hệ", "/contact"],
      ["Điều khoản", "/terms-of-service"],
      ["Quyền riêng tư", "/privacy-policy"],
    ],
  },
];

export function Pricing() {
  return (
    <section
      id="bang-gia"
      className="al-rv"
      aria-labelledby="bg-h"
      style={{
        padding: "0 0 112px",
        display: "flex",
        flexDirection: "column",
        gap: 40,
      }}
    >
      <div className="al-head">
        <p className="al-eyebrow">Bảng giá</p>
        <h2 id="bg-h" className="al-h2">
          Trả theo bài được chấm
        </h2>
        <p className="al-lede">(Không phải theo token.)</p>
      </div>
      <div className="al-plans">
        <span className="al-tick al-tl" />
        <span className="al-tick al-tr" />
        <span className="al-tick al-bl" />
        <span className="al-tick al-br" />
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={p.hot ? "al-plan al-plan-hot" : "al-plan"}
          >
            <p style={{ fontWeight: 600 }}>
              {p.name}
              <br />
              <span className="al-muted" style={{ fontWeight: 400 }}>
                {p.who}
              </span>
            </p>
            <p className="al-price">
              {p.price}
              {p.unit && (
                <span
                  className="al-muted"
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    fontFamily: "var(--al-body)",
                  }}
                >
                  {" "}
                  {p.unit}
                </span>
              )}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {p.tags.map((t) => (
                <span key={t} className="al-tag">
                  {t}
                </span>
              ))}
            </div>
            <Link
              href={p.cta.href}
              className={`al-btn ${p.cta.cls}`}
              style={{ alignSelf: "flex-start", marginTop: "auto" }}
            >
              {p.cta.label}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section style={{ padding: "0 24px 112px" }}>
      <div
        className="al-halftone"
        style={{
          position: "relative",
          borderRadius: 28,
          overflow: "hidden",
          padding: "88px 32px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div className="al-sun" aria-hidden="true" style={{ bottom: -330 }} />
        <h2
          className="al-h2"
          style={{
            position: "relative",
            fontSize: 48,
            lineHeight: "54px",
            color: "#FFFFFF",
            maxWidth: 720,
          }}
        >
          Bài đầu tiên được chấm trong một phút
        </h2>
        <p
          style={{
            position: "relative",
            fontSize: 18,
            lineHeight: "28px",
            color: "var(--al-tint)",
          }}
        >
          Tạo key sandbox, gửi một bài Task 2, xem kết quả.
        </p>
        <div
          style={{
            position: "relative",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "center",
          }}
        >
          <Link href="/register" className="al-btn al-btn-white">
            Lấy API key miễn phí →
          </Link>
          <Link href="/docs" className="al-btn al-btn-glass">
            Đọc tài liệu
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter({ host }: { host: string }) {
  return (
    <footer className="al-footer">
      <div className="al-footer-cols">
        <div className="al-footer-col">
          <LandingLogo />
          <p className="al-muted">
            API AI chuyên biệt cho giáo dục. Một sản phẩm của WAGON.
          </p>
        </div>
        {FOOTER.map((col) => (
          <div key={col.title} className="al-footer-col">
            <h4 style={{ fontSize: 14, lineHeight: "20px" }}>{col.title}</h4>
            {col.links.map(([label, href]) => (
              <Link key={label} href={href}>
                {label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div
        className="al-muted"
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 13,
        }}
      >
        <span>© AiHub 2026</span>
        <span className="al-mono">{host.replace(/^https?:\/\//, "")}</span>
      </div>
    </footer>
  );
}
