"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type Audience = "prompt" | "curl";

const AUDIENCES: { id: Audience; label: string; hint: string }[] = [
  {
    id: "prompt",
    label: "Prompt cho AI",
    hint: "Dán vào ChatGPT, Claude, Cursor hoặc agent bất kỳ. Không cần biết code.",
  },
  {
    id: "curl",
    label: "cURL cho developer",
    hint: "Chạy trong terminal. Thay bài mẫu bằng bài của bạn.",
  },
];

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
    } catch {
      setCopied(`${id}:failed`);
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2000);
  }
  return { copied, copy };
}

/**
 * The public trial key and the two ways to use it (ADR-0023). The texts are
 * built on the server so the key is read from env once and the client bundle
 * carries no prompt template.
 */
export function TrialKey({
  apiKey,
  prompt,
  curl,
  dailyLimit,
  perIpLimit,
}: {
  apiKey: string | null;
  prompt: string;
  curl: string;
  dailyLimit: number;
  perIpLimit: number;
}) {
  const [tab, setTab] = useState<Audience>("prompt");
  const { copied, copy } = useCopy();
  const text = tab === "prompt" ? prompt : curl;
  const audience = AUDIENCES.find((a) => a.id === tab) ?? AUDIENCES[0];

  function label(id: string, idle: string) {
    if (copied === id) return "Đã copy ✓";
    if (copied === `${id}:failed`) return "Không copy được";
    return idle;
  }

  return (
    <section
      id="dung-thu"
      aria-labelledby="dt-h"
      style={{ padding: "0 24px 112px", scrollMarginTop: 96 }}
    >
      <div
        className="al-panel"
        style={{
          borderRadius: 28,
          padding: "40px clamp(20px, 4vw, 48px)",
          display: "flex",
          flexDirection: "column",
          gap: 28,
          boxShadow: "0 0 80px rgba(91,95,239,.22)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p className="al-eyebrow">Dùng thử ngay · không cần đăng ký</p>
          <h2
            id="dt-h"
            style={{
              fontSize: "clamp(30px, 4vw, 40px)",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            Copy một prompt, chấm bài đầu tiên trong một phút
          </h2>
          <p className="al-muted" style={{ fontSize: 17, lineHeight: "26px" }}>
            Key dùng thử công khai cho mọi người: {dailyLimit} lượt chấm mỗi
            ngày dùng chung, tối đa {perIpLimit} lượt cho mỗi IP, đặt lại lúc
            07:00 sáng giờ Việt Nam. Hết lượt thì{" "}
            <Link href="/register" style={{ textDecoration: "underline" }}>
              tạo key riêng
            </Link>
            .
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            padding: "14px 16px",
            borderRadius: 16,
            border: "1px solid var(--al-line)",
            background: "var(--al-bg)",
          }}
        >
          <span className="al-muted" style={{ fontSize: 14 }}>
            Trial key
          </span>
          {apiKey ? (
            <>
              <code
                className="al-mono"
                data-testid="trial-key"
                style={{
                  flex: "1 1 260px",
                  minWidth: 0,
                  overflowWrap: "anywhere",
                  fontSize: 14,
                }}
              >
                {apiKey}
              </code>
              <button
                type="button"
                className="al-btn al-btn-line"
                onClick={() => copy("key", apiKey)}
              >
                {label("key", "Copy key")}
              </button>
            </>
          ) : (
            <span style={{ flex: "1 1 260px", fontSize: 15 }}>
              Key dùng thử đang được cấp. Trong lúc chờ,{" "}
              <Link href="/register" style={{ textDecoration: "underline" }}>
                tạo key Sandbox miễn phí
              </Link>{" "}
              rồi thay vào chỗ{" "}
              <code className="al-mono">&lt;AIHUB_TRIAL_KEY&gt;</code>.
            </span>
          )}
        </div>

        <div
          style={{
            borderRadius: 20,
            border: "1px solid var(--al-line)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              padding: "12px 16px",
              borderBottom: "1px solid var(--al-line)",
              alignItems: "center",
            }}
          >
            <div
              role="tablist"
              aria-label="Cách dùng key dùng thử"
              style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
            >
              {AUDIENCES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  id={`dt-tab-${a.id}`}
                  aria-selected={a.id === tab}
                  aria-controls="dt-panel"
                  className="al-tab"
                  onClick={() => setTab(a.id)}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="al-btn al-btn-primary"
              style={{ marginLeft: "auto" }}
              onClick={() => copy(tab, text)}
            >
              {label(tab, tab === "prompt" ? "Copy prompt" : "Copy lệnh")}
            </button>
          </div>
          <p
            className="al-muted"
            style={{ padding: "12px 20px 0", fontSize: 14 }}
          >
            {audience.hint}
          </p>
          <div
            role="tabpanel"
            id="dt-panel"
            aria-labelledby={`dt-tab-${tab}`}
            tabIndex={0}
            style={{
              padding: "12px 20px 20px",
              maxHeight: 360,
              overflow: "auto",
              background: "var(--al-bg)",
            }}
          >
            <pre
              className="al-mono"
              data-testid="trial-text"
              style={{
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                fontSize: 13,
                lineHeight: "20px",
                margin: 0,
              }}
            >
              {text}
            </pre>
          </div>
        </div>
        <p role="status" aria-live="polite" className="al-sr-only">
          {copied && !copied.endsWith(":failed") ? "Đã copy vào clipboard" : ""}
        </p>
      </div>
    </section>
  );
}
