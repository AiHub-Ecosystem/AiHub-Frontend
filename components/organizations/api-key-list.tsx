"use client";

import Link from "next/link";
import { useState } from "react";
import {
  apiKeyEnvironmentLabel,
  type OrganizationApiKey,
} from "@/lib/api-keys";
import { hasQuickstart, quickstartPath } from "@/lib/sample-request";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

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
  organizationId,
  onRotate,
  onRevoke,
}: {
  apiKeys: OrganizationApiKey[];
  busy: boolean;
  organizationId: string;
  onRotate: (apiKey: OrganizationApiKey) => void;
  onRevoke: (apiKey: OrganizationApiKey) => Promise<boolean>;
}) {
  const [pendingRevoke, setPendingRevoke] = useState<OrganizationApiKey | null>(
    null
  );
  const [revoking, setRevoking] = useState(false);

  async function confirmRevoke(apiKey: OrganizationApiKey) {
    if (revoking) return;
    setRevoking(true);
    try {
      if (await onRevoke(apiKey)) setPendingRevoke(null);
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
                <th scope="col">Key</th>
                <th scope="col">Quyền</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Thời hạn</th>
                <th scope="col">Dùng gần nhất (xấp xỉ)</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((apiKey) => (
                <tr key={apiKey.id}>
                  <th scope="row">
                    <span className="api-key-name">{apiKey.name}</span>
                    <code className="api-key-prefix">{apiKey.key_prefix}</code>
                  </th>
                  <td data-label="Quyền">
                    <div className="api-key-chips">
                      {apiKey.scopes.map((scope) => (
                        <code className="api-key-chip" key={scope}>
                          {scope}
                        </code>
                      ))}
                      {apiKey.allowed_environments.map((environment) => (
                        <span
                          className={`api-key-env api-key-env--${environment}`}
                          key={environment}
                        >
                          {apiKeyEnvironmentLabel(environment)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td data-label="Trạng thái">
                    <span
                      className={`api-key-status api-key-status--${apiKey.status}`}
                    >
                      {apiKey.status === "expired"
                        ? "Hết hạn"
                        : "Đang hoạt động"}
                    </span>
                  </td>
                  <td data-label="Thời hạn">
                    <span className="api-key-date">
                      {apiKey.expires_at
                        ? `Hạn: ${displayDate(apiKey.expires_at)}`
                        : "Không hết hạn"}
                    </span>
                    <span className="api-key-date api-key-date--muted">
                      Tạo: {displayDate(apiKey.created_at)}
                    </span>
                  </td>
                  <td data-label="Dùng gần nhất">
                    {displayDate(apiKey.last_used_at)}
                  </td>
                  <td data-label="Thao tác">
                    <div className="api-key-row-actions">
                      {hasQuickstart(apiKey) && (
                        <Link
                          className="api-key-action"
                          href={quickstartPath(organizationId, apiKey.id)}
                        >
                          Gọi thử
                        </Link>
                      )}
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
                      <ConfirmationDialog
                        body={
                          <p>
                            Bạn sắp thu hồi <strong>{apiKey.name}</strong> (
                            <code>{apiKey.key_prefix}</code>). Key sẽ không thể
                            dùng lại.
                          </p>
                        }
                        cancelLabel="Hủy"
                        confirmLabel="Xác nhận thu hồi"
                        destructive
                        onConfirm={() => confirmRevoke(apiKey)}
                        onOpenChange={(open) => {
                          if (revoking && !open) return;
                          setPendingRevoke(open ? apiKey : null);
                        }}
                        open={pendingRevoke?.id === apiKey.id}
                        pending={revoking}
                        pendingLabel="Đang thu hồi…"
                        title="Thu hồi API key?"
                        trigger={
                          <button
                            className="api-key-action api-key-action--danger"
                            disabled={busy}
                            type="button"
                          >
                            Thu hồi
                          </button>
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
