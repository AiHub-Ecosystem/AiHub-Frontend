"use client";

import { useEffect, useState } from "react";

type CopyStatus = "idle" | "copied" | "failed";

/**
 * A code sample with a copy button. The samples on /docs hold placeholders
 * only, so copying reaches no secret. The status sits in a reserved,
 * always-mounted live region so it is announced without moving the layout.
 */
export function CodeBlock({ code, label }: { code: string; label: string }) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="aihub-codeblock">
      <div className="aihub-codeblock-bar">
        <span className="aihub-codeblock-label">{label}</span>
        <span className="aihub-copy-status" role="status">
          {status === "copied" && "Đã sao chép"}
          {status === "failed" &&
            "Không sao chép tự động được — hãy chọn và sao chép thủ công"}
        </span>
        <button
          className="aihub-copy"
          type="button"
          onClick={() => void copy()}
          aria-label={`Sao chép: ${label}`}
        >
          Sao chép
        </button>
      </div>
      <pre className="aihub-code" tabIndex={0} aria-label={label}>
        {code}
      </pre>
    </div>
  );
}
