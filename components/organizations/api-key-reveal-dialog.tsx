"use client";

import { useEffect, useRef, useState } from "react";
import type { MintedOrganizationApiKey } from "@/lib/api-keys";
import { buildWritingSampleRequest } from "@/lib/writing-sample-request";

export function ApiKeyRevealDialog({
  apiKey,
  identityConfigured,
  onClose,
  onCopyError,
}: {
  apiKey: MintedOrganizationApiKey | null;
  identityConfigured?: boolean;
  onClose: () => void;
  onCopyError: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState<"key" | "command" | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  useEffect(() => {
    if (apiKey && dialog.current && !dialog.current.open) {
      setIdempotencyKey(crypto.randomUUID());
      setCopied(null);
      dialog.current.showModal();
    }
    if (!apiKey && dialog.current?.open) {
      setIdempotencyKey(null);
      setCopied(null);
      dialog.current.close();
    }
  }, [apiKey]);

  const sample =
    apiKey && idempotencyKey
      ? buildWritingSampleRequest({
          apiKey,
          identityConfigured,
          idempotencyKey,
        })
      : null;

  async function copy(text: string, item: "key" | "command") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(item);
    } catch {
      onCopyError();
    }
  }

  return (
    <dialog
      aria-labelledby="api-key-reveal-title"
      className="api-key-reveal"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      ref={dialog}
    >
      {apiKey && (
        <>
          <h2 id="api-key-reveal-title">API key mới</h2>
          <p>
            Sao chép và lưu key này ngay. Key chỉ hiển thị lần này và không thể
            xem lại sau khi đóng hộp thoại.
          </p>
          <code className="api-key-raw" data-testid="api-key-raw">
            {apiKey.api_key}
          </code>
          <div className="api-key-dialog-actions">
            <button
              className="api-key-action"
              onClick={() => void copy(apiKey.api_key, "key")}
              type="button"
            >
              {copied === "key" ? "Đã sao chép" : "Sao chép key"}
            </button>
            <button
              className="auth-submit api-key-dialog-close"
              onClick={onClose}
              type="button"
            >
              Đóng
            </button>
          </div>
          {sample && (
            <section
              aria-labelledby="writing-sample-title"
              className="api-key-sample"
            >
              <h3 id="writing-sample-title">Gọi thử</h3>
              <div aria-label="Sample requests" role="tablist">
                <button
                  aria-controls="writing-sample-panel"
                  aria-selected="true"
                  className="api-key-sample-tab"
                  id="writing-sample-tab"
                  role="tab"
                  type="button"
                >
                  Writing
                </button>
              </div>
              <div
                aria-labelledby="writing-sample-tab"
                className="api-key-sample-panel"
                id="writing-sample-panel"
                role="tabpanel"
              >
                <p className="api-key-sample-endpoint">
                  <strong>{sample.method}</strong> <code>{sample.url}</code>
                </p>
                <h4>Headers</h4>
                <table aria-label="Writing request headers">
                  <thead>
                    <tr>
                      <th scope="col">Header</th>
                      <th scope="col">Value</th>
                      <th scope="col">Ý nghĩa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sample.headers.map((header) => (
                      <tr key={header.name}>
                        <th scope="row">{header.name}</th>
                        <td>
                          <code>{header.value}</code>
                        </td>
                        <td>{header.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="api-key-sample-note">{sample.identityNote}</p>
                <h4>Body</h4>
                <table aria-label="Writing request body">
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">Giá trị mẫu</th>
                      <th scope="col">Bắt buộc</th>
                      <th scope="col">Ý nghĩa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sample.body.map((field) => (
                      <tr key={field.field}>
                        <th scope="row">{field.field}</th>
                        <td className="api-key-sample-value">
                          <code>{field.sampleValue}</code>
                        </td>
                        <td>{field.required ? "Có" : "Không"}</td>
                        <td>{field.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="api-key-sample-note">
                  Chạy lại cùng body với Idempotency-Key này sẽ phát lại kết quả
                  đã lưu trong 24 giờ. Bài nộp mới cần một UUID mới.
                </p>
                <h4>Kết quả dự kiến</h4>
                <p>
                  <strong>200</strong>: response có <code>overall_band</code>,{" "}
                  <code>criteria</code> và <code>summary</code>.
                </p>
                <p>Lỗi thường gặp:</p>
                <ul className="api-key-sample-errors">
                  <li>
                    <code>401 UNAUTHORIZED</code>
                  </li>
                  <li>
                    <code>401 INVALID_USER_IDENTITY</code>
                  </li>
                  <li>
                    <code>403 FORBIDDEN</code>
                  </li>
                  <li>
                    <code>403 ENVIRONMENT_NOT_ALLOWED</code>
                  </li>
                  <li>
                    <code>429 RATE_LIMITED</code>
                  </li>
                  <li>
                    <code>429 QUOTA_EXCEEDED</code>
                  </li>
                </ul>
                <p className="api-key-sample-warning">
                  Lệnh gửi request thật và tính vào hạn mức sử dụng của
                  Organization.
                </p>
                {sample.command ? (
                  <>
                    <div className="api-key-sample-command-heading">
                      <h4>Lệnh cho Bash-compatible shell</h4>
                      <button
                        className="api-key-action"
                        onClick={() => void copy(sample.command!, "command")}
                        type="button"
                      >
                        {copied === "command"
                          ? "Đã sao chép lệnh"
                          : "Sao chép lệnh"}
                      </button>
                    </div>
                    <pre
                      className="api-key-sample-command"
                      data-testid="writing-sample-command"
                      tabIndex={0}
                    >
                      <code>{sample.command}</code>
                    </pre>
                  </>
                ) : (
                  <p className="api-key-sample-note" role="status">
                    AIHUB chưa có staging host công khai; API key này không có
                    quyền production nên chưa thể chạy lệnh mẫu.
                  </p>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </dialog>
  );
}
