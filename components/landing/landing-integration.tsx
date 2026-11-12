"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
const GRADE_PATH = "/v1/ielts/writing/task2/grade";

const k = (t: string) => <span className="al-k">{t}</span>;
const s = (t: string) => <span className="al-s">{t}</span>;
const n = (t: string) => <span className="al-n">{t}</span>;
const c = (t: string) => <span className="al-c">{t}</span>;

function samples(
  GRADE_URL: string
): { id: string; label: string; code: ReactNode }[] {
  return [
    {
      id: "curl",
      label: "cURL",
      code: (
        <>
          {c("# Chấm một bài Writing Task 2")}
          {`\ncurl -X POST ${GRADE_URL} \\\n  -H `}
          {s('"X-API-Key: $AIHUB_API_KEY"')}
          {" \\\n  -H "}
          {s('"X-User-Identity: $AIHUB_USER_IDENTITY"')}
          {" \\\n  -H "}
          {s('"Idempotency-Key: $(uuidgen)"')}
          {" \\\n  -H "}
          {s('"Content-Type: application/json"')}
          {" \\\n  -d "}
          {s(
            `'{ "topic": "education",\n        "question": "Should university be free?",\n        "essay": "Nowadays, many people …" }'`
          )}
          <span className="al-caret" aria-hidden="true" />
        </>
      ),
    },
    {
      id: "node",
      label: "Node.js",
      code: (
        <>
          {k("const")} res = {k("await")} fetch(
          {"\n  "}
          {s(`"${GRADE_URL}"`)},{"\n  {\n    method: "}
          {s('"POST"')},{"\n    headers: {\n      "}
          {s('"X-API-Key"')}: process.env.AIHUB_API_KEY,{"\n      "}
          {s('"X-User-Identity"')}: learnerId,{"\n      "}
          {s('"Idempotency-Key"')}: crypto.randomUUID(),{"\n      "}
          {s('"Content-Type"')}: {s('"application/json"')}
          {
            "\n    },\n    body: JSON.stringify({ topic, question, essay })\n  }\n);\n"
          }
          {k("const")} {"{ data, meta }"} = {k("await")} res.json();
        </>
      ),
    },
    {
      id: "py",
      label: "Python",
      code: (
        <>
          {k("import")} os, uuid, requests{"\n\nr = requests.post(\n    "}
          {s(`"${GRADE_URL}"`)},{"\n    headers={\n        "}
          {s('"X-API-Key"')}: os.environ[{s('"AIHUB_API_KEY"')}],{"\n        "}
          {s('"X-User-Identity"')}: learner_id,{"\n        "}
          {s('"Idempotency-Key"')}: str(uuid.uuid4()),{"\n    },\n    json={"}
          {s('"topic"')}: {s('"education"')}, {s('"question"')}: q,{" "}
          {s('"essay"')}: essay{"},\n    timeout="}
          {n("90")},{"\n)"}
        </>
      ),
    },
  ];
}

const STEPS = [
  {
    title: "Tạo key trên Console",
    body: "Key sandbox và production tách riêng.",
  },
  { title: "Thử trên sandbox", body: "25 lượt chấm Writing miễn phí." },
  { title: "Gắn vào backend", body: "Gửi mã học viên qua X-User-Identity." },
];

/** `host` comes from the server so this client bundle does not pull in the whole docs guide. */
export function Integration({ host }: { host: string }) {
  const SAMPLES = samples(`${host}${GRADE_PATH}`);
  const [tab, setTab] = useState("curl");
  const sample = SAMPLES.find((x) => x.id === tab) ?? SAMPLES[0];
  return (
    <section
      id="tich-hop"
      className="al-rv"
      aria-labelledby="th-h"
      style={{ padding: "0 24px 112px" }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 48,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            flex: "1 1 360px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <p className="al-eyebrow">Tích hợp</p>
          <h2
            id="th-h"
            style={{
              fontSize: 40,
              lineHeight: "46px",
              letterSpacing: "-0.02em",
            }}
          >
            Ba bước đến lần chấm đầu tiên
          </h2>
          <ol style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {STEPS.map((st, i) => (
              <li key={st.title} style={{ display: "flex", gap: 14 }}>
                <span
                  className="al-mono"
                  style={{
                    flex: "none",
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    ...(i === 0
                      ? {
                          background: "var(--al-primary)",
                          color: "#FFFFFF",
                          boxShadow: "0 0 18px rgba(91,95,239,.6)",
                        }
                      : { border: "1px solid var(--al-line)" }),
                  }}
                >
                  {i + 1}
                </span>
                <div>
                  <h3 style={{ fontSize: 18, lineHeight: "24px" }}>
                    {st.title}
                  </h3>
                  <p
                    className="al-muted"
                    style={{ fontSize: 15, lineHeight: "22px" }}
                  >
                    {st.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href="/docs"
            className="al-btn al-btn-line"
            style={{ alignSelf: "flex-start" }}
          >
            Đọc hướng dẫn tích hợp →
          </Link>
        </div>
        <div
          className="al-panel"
          style={{
            flex: "1.6 1 520px",
            minWidth: 0,
            overflow: "hidden",
            borderRadius: 24,
            boxShadow: "0 0 60px rgba(91,95,239,.18)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              padding: "14px 18px",
              borderBottom: "1px solid var(--al-line)",
              alignItems: "center",
            }}
          >
            <span
              style={{ display: "flex", gap: 6, marginRight: 8 }}
              aria-hidden="true"
            >
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: "var(--al-line)",
                  }}
                />
              ))}
            </span>
            <div
              role="tablist"
              aria-label="Ngôn ngữ ví dụ"
              style={{ display: "flex", gap: 8 }}
            >
              {SAMPLES.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={x.id === tab}
                  className="al-tab"
                  onClick={() => setTab(x.id)}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <div
            role="tabpanel"
            aria-label={sample.label}
            style={{
              padding: 24,
              overflowX: "auto",
              minHeight: 320,
              background: "var(--al-bg)",
            }}
          >
            <pre key={sample.id} className="al-ln">
              {sample.code}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
