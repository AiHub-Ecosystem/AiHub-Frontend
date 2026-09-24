"use client";

import { useState } from "react";
import type { OrganizationApiKey } from "@/lib/api-keys";

function displayDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ApiKeyList({
  apiKeys,
  busy,
  onRotate,
  onRevoke,
}: {
  apiKeys: OrganizationApiKey[];
  busy: boolean;
  onRotate: (apiKey: OrganizationApiKey) => void;
  onRevoke: (apiKey: OrganizationApiKey) => Promise<boolean>;
}) {
  const [pendingRevoke, setPendingRevoke] = useState<OrganizationApiKey | null>(
    null
  );
  const [revoking, setRevoking] = useState(false);

  async function confirmRevoke() {
    if (!pendingRevoke || revoking) return;
    setRevoking(true);
    try {
      if (await onRevoke(pendingRevoke)) setPendingRevoke(null);
    } finally {
      setRevoking(false);
    }
  }

  return (
    <>
      {apiKeys.length === 0 ? (
        <p className="api-key-empty" role="status">
          Chưa có API key nào trong Organization này.
        </p>
      ) : (
        <div className="api-key-table-wrap">
          <table aria-label="API keys" className="api-key-table">
            <thead>
              <tr>
                <th scope="col">Tên</th>
                <th scope="col">Key prefix</th>
                <th scope="col">Scopes</th>
                <th scope="col">Môi trường</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Hết hạn</th>
                <th scope="col">Dùng gần nhất (xấp xỉ)</th>
                <th scope="col">Tạo lúc</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((apiKey) => (
                <tr key={apiKey.id}>
                  <th scope="row">{apiKey.name}</th>
                  <td>
                    <code>{apiKey.key_prefix}</code>
                  </td>
                  <td>{apiKey.scopes.join(", ")}</td>
                  <td>{apiKey.allowed_environments.join(", ")}</td>
                  <td>
                    <span
                      className={`api-key-status api-key-status--${apiKey.status}`}
                    >
                      {apiKey.status === "expired"
                        ? "Hết hạn"
                        : "Đang hoạt động"}
                    </span>
                  </td>
                  <td>
                    {apiKey.expires_at
                      ? displayDate(apiKey.expires_at)
                      : "Không hết hạn"}
                  </td>
                  <td>{displayDate(apiKey.last_used_at)}</td>
                  <td>{displayDate(apiKey.created_at)}</td>
                  <td>
                    <div className="api-key-row-actions">
                      {apiKey.status === "active" && (
                        <button
                          className="api-key-action"
                          disabled={busy}
                          onClick={() => onRotate(apiKey)}
                          type="button"
                        >
                          Xoay key
                        </button>
                      )}
                      <button
                        className="api-key-action api-key-action--danger"
                        disabled={busy}
                        onClick={() => setPendingRevoke(apiKey)}
                        type="button"
                      >
                        Thu hồi
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingRevoke && (
        <div className="api-key-confirm-backdrop">
          <section
            aria-labelledby="api-key-revoke-title"
            aria-modal="true"
            className="api-key-confirm"
            role="alertdialog"
          >
            <h2 id="api-key-revoke-title">Thu hồi API key?</h2>
            <p>
              Bạn sắp thu hồi <strong>{pendingRevoke.name}</strong> (
              <code>{pendingRevoke.key_prefix}</code>). Key sẽ không thể dùng
              lại.
            </p>
            <div className="api-key-dialog-actions">
              <button
                className="api-key-action"
                disabled={revoking}
                onClick={() => setPendingRevoke(null)}
                type="button"
              >
                Hủy
              </button>
              <button
                className="api-key-action api-key-action--danger"
                disabled={revoking}
                onClick={confirmRevoke}
                type="button"
              >
                {revoking ? "Đang thu hồi…" : "Xác nhận thu hồi"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
