"use client";

import { useState } from "react";

export function ReferenceTabs({ requestCode, responseCode }: { requestCode: string; responseCode: string }) {
  const [tab, setTab] = useState<"request" | "response">("request");

  return (
    <div>
      <div className="aihub-tabs">
        <button
          type="button"
          role="tab"
          className="aihub-tab"
          aria-selected={tab === "request"}
          onClick={() => setTab("request")}
        >
          Request
        </button>
        <button
          type="button"
          role="tab"
          className="aihub-tab"
          aria-selected={tab === "response"}
          onClick={() => setTab("response")}
        >
          Response
        </button>
      </div>
      <pre className="aihub-code">{tab === "request" ? requestCode : responseCode}</pre>
    </div>
  );
}
