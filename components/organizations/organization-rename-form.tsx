"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrganizationRenameForm({
  organizationId,
  name,
}: {
  organizationId: string;
  name: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.get("name") }),
        }
      );
      if (response.status === 403 || response.status === 404) {
        router.replace("/console/orgs/denied");
        return;
      }
      if (!response.ok) {
        setError(
          response.status === 400
            ? "Tên phải có từ 1 đến 100 ký tự."
            : "Không thể đổi tên lúc này. Vui lòng thử lại."
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="rename-organization">Đổi tên Organization</label>
      <input
        id="rename-organization"
        name="name"
        defaultValue={name}
        required
      />
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <button className="auth-submit" disabled={busy} type="submit">
        {busy ? "Đang lưu…" : "Lưu tên mới"}
      </button>
    </form>
  );
}
