"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function OrganizationCreationForm({
  openOnMount = false,
}: {
  openOnMount?: boolean;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const key = useRef<string | null>(null);
  const [open, setOpen] = useState(openOnMount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const name = new FormData(event.currentTarget).get("name");
    if (typeof name !== "string") return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (!key.current) {
        const keyResponse = await fetch("/api/organizations/creation-key", {
          method: "POST",
        });
        if (!keyResponse.ok) throw new Error("SERVICE_UNAVAILABLE");
        key.current = (await keyResponse.json()).idempotencyKey;
      }
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key.current!,
        },
        body: JSON.stringify({ name }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.error?.code === "ORGANIZATION_CREATION_LIMIT_REACHED") {
          key.current = null;
          setError(
            "Bạn đã đạt Organization Creation Limit: tối đa ba Organization trong suốt thời gian sử dụng. Liên hệ AIHUB để yêu cầu thêm."
          );
        } else if (result.error?.code === "INVALID_NAME") {
          key.current = null;
          setError(
            "Tên Organization phải có từ 1 đến 100 ký tự sau khi bỏ khoảng trắng đầu cuối."
          );
        } else if (response.status >= 500) {
          setError("Chưa xác nhận được kết quả. Bạn có thể thử lại an toàn.");
        } else {
          key.current = null;
          setError(
            "Không thể tạo Organization. Vui lòng kiểm tra thông tin và thử lại."
          );
        }
        return;
      }
      const id = result.data?.organization?.organization_id;
      if (typeof id !== "string" || !id) {
        setError("Chưa xác nhận được kết quả. Bạn có thể thử lại an toàn.");
        return;
      }
      const completed = await fetch(
        "/api/organizations/creation-key/complete",
        {
          method: "POST",
        }
      );
      if (!completed.ok) {
        setError("Tổ chức đã được tạo. Hãy thử lại để xác nhận và tiếp tục.");
        return;
      }
      key.current = null;
      router.push(`/console/orgs/${encodeURIComponent(id)}/api-keys`);
    } catch {
      setError("Không thể kết nối. Bạn có thể thử lại an toàn.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <button className="console-primary-action" type="button">
          {openOnMount ? "Mở lại biểu mẫu" : "Tạo Organization"}
        </button>
      </DialogTrigger>
      <DialogContent aria-describedby="organization-create-description">
        <DialogHeader>
          <DialogTitle>Tạo Organization mới</DialogTitle>
          <DialogDescription id="organization-create-description">
            Mỗi tài khoản có thể tạo tối đa ba Organization.
          </DialogDescription>
        </DialogHeader>
        <form className="auth-form dialog-form" onSubmit={submit}>
          <label htmlFor="organization-name">Tên Organization</label>
          <input id="organization-name" name="name" minLength={1} required />
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button className="auth-submit" disabled={busy} type="submit">
            {busy ? "Đang tạo…" : "Tạo Organization"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
