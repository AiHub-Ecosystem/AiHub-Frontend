"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  const [open, setOpen] = useState(false);

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
      setOpen(false);
      router.refresh();
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError("");
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <button className="org-secondary-action" type="button">
          Đổi tên
        </button>
      </DialogTrigger>
      <DialogContent aria-describedby="rename-organization-description">
        <DialogHeader>
          <DialogTitle>Đổi tên Organization</DialogTitle>
          <DialogDescription id="rename-organization-description">
            Tên mới hiển thị với mọi thành viên của Organization.
          </DialogDescription>
        </DialogHeader>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="rename-organization">Tên mới</label>
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
      </DialogContent>
    </Dialog>
  );
}
