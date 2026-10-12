"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ponytail: AIHUB expires idempotency records after 24h; extend backend retention if recovery must last longer.
const CREATION_ATTEMPT_STORAGE_KEY = "aihub:organization-creation-attempt";
const CREATION_ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;
const EXPIRED_ATTEMPT_MESSAGE =
  "Lần tạo này đã quá 24 giờ hoặc không xác định được thời điểm; retry có thể tạo trùng Organization. Hãy kiểm tra danh sách Organization. Nếu kết quả chưa rõ, liên hệ hỗ trợ trước khi bắt đầu lần tạo mới.";
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CreationAttempt = {
  idempotencyKey: string;
  name: string;
  createdAt: number;
};

function attemptExpired(attempt: CreationAttempt, now = Date.now()) {
  return (
    attempt.createdAt <= 0 ||
    now < attempt.createdAt ||
    now - attempt.createdAt >= CREATION_ATTEMPT_TTL_MS
  );
}

export function OrganizationCreationForm({
  openOnMount = false,
}: {
  openOnMount?: boolean;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [open, setOpen] = useState(openOnMount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [attempt, setAttempt] = useState<CreationAttempt | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const expired = attempt ? attemptExpired(attempt) : false;

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(CREATION_ATTEMPT_STORAGE_KEY);
      if (stored) {
        const value: unknown = JSON.parse(stored);
        if (
          value &&
          typeof value === "object" &&
          "idempotencyKey" in value &&
          typeof value.idempotencyKey === "string" &&
          UUID_V4_PATTERN.test(value.idempotencyKey) &&
          "name" in value &&
          typeof value.name === "string"
        ) {
          const createdAt =
            "createdAt" in value &&
            typeof value.createdAt === "number" &&
            Number.isFinite(value.createdAt)
              ? value.createdAt
              : 0;
          const restoredAttempt = {
            idempotencyKey: value.idempotencyKey,
            name: value.name,
            createdAt,
          };
          // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is client-only and must restore after hydration.
          setAttempt(restoredAttempt);
          setName(restoredAttempt.name);
        } else {
          sessionStorage.removeItem(CREATION_ATTEMPT_STORAGE_KEY);
        }
      }
    } catch {
      try {
        sessionStorage.removeItem(CREATION_ATTEMPT_STORAGE_KEY);
      } catch {}
    }
    setStorageReady(true);
  }, []);

  function clearAttempt() {
    sessionStorage.removeItem(CREATION_ATTEMPT_STORAGE_KEY);
    setAttempt(null);
  }

  // Keep response and storage decisions together: only ambiguous results retain this attempt.
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !storageReady) return;
    if (attempt && attemptExpired(attempt)) {
      setError(EXPIRED_ATTEMPT_MESSAGE);
      return;
    }
    const submittedName = new FormData(event.currentTarget).get("name");
    if (typeof submittedName !== "string") return;
    if (attempt && attempt.name !== submittedName) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      let currentAttempt = attempt;
      if (!currentAttempt) {
        currentAttempt = {
          idempotencyKey: crypto.randomUUID(),
          name: submittedName,
          createdAt: Date.now(),
        };
        try {
          sessionStorage.setItem(
            CREATION_ATTEMPT_STORAGE_KEY,
            JSON.stringify(currentAttempt)
          );
        } catch {
          setError("Không thể lưu lần tạo trong tab. Vui lòng thử lại.");
          return;
        }
        setAttempt(currentAttempt);
      }
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": currentAttempt.idempotencyKey,
        },
        body: JSON.stringify({ name: currentAttempt.name }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/login?error=session");
        } else if (result.error?.code === "IDEMPOTENCY_CONFLICT") {
          setError(
            "Yêu cầu đang được xử lý. Hãy thử lại sau với cùng tên Organization."
          );
        } else if (
          result.error?.code === "ORGANIZATION_CREATION_LIMIT_REACHED"
        ) {
          clearAttempt();
          setError(
            "Bạn đã đạt Organization Creation Limit: tối đa ba Organization trong suốt thời gian sử dụng. Liên hệ AIHUB để yêu cầu thêm."
          );
        } else if (result.error?.code === "INVALID_NAME") {
          clearAttempt();
          setError(
            "Tên Organization phải có từ 1 đến 100 ký tự sau khi bỏ khoảng trắng đầu cuối."
          );
        } else if (response.status >= 500) {
          setError("Chưa xác nhận được kết quả. Bạn có thể thử lại an toàn.");
        } else {
          clearAttempt();
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
      clearAttempt();
      router.push(
        `/console/orgs/${encodeURIComponent(id)}?identity=open&onboarding=1`
      );
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
          <input
            id="organization-name"
            name="name"
            minLength={1}
            onChange={(event) => setName(event.target.value)}
            readOnly={Boolean(attempt)}
            required
            value={attempt?.name ?? name}
          />
          {(expired || error) && (
            <p className="auth-error" role="alert">
              {expired ? EXPIRED_ATTEMPT_MESSAGE : error}
            </p>
          )}
          {expired && (
            <button
              className="auth-submit"
              onClick={clearAttempt}
              type="button"
            >
              Đã kiểm tra, bắt đầu lần tạo mới
            </button>
          )}
          <button
            className="auth-submit"
            disabled={busy || !storageReady || expired}
            type="submit"
          >
            {busy ? "Đang tạo…" : "Tạo Organization"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
