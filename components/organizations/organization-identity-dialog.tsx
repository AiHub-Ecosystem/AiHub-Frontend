"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { OrganizationIdentityForm } from "@/components/organizations/organization-identity-form";
import {
  parseOrganizationIdentityConfig,
  type OrganizationIdentityConfig,
} from "@/lib/organization-identity";

export function OrganizationIdentityDialog({
  organizationId,
  organizationName,
  onboarding = false,
  defaultOpen = false,
}: {
  organizationId: string;
  organizationName: string;
  onboarding?: boolean;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [config, setConfig] = useState<OrganizationIdentityConfig | null>(null);
  const [loading, setLoading] = useState(defaultOpen);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();

    void fetch(
      `/api/organizations/${encodeURIComponent(organizationId)}/identity-config`,
      { signal: controller.signal }
    )
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (response.status === 403) {
          setForbidden(true);
          router.refresh();
          return;
        }
        if (!response.ok) throw new Error("IDENTITY_CONFIG_REQUEST_FAILED");
        const parsed = parseOrganizationIdentityConfig(result);
        if (!parsed) throw new Error("IDENTITY_CONFIG_RESPONSE_INVALID");
        setConfig(parsed);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Không thể tải identity configuration. Hãy thử lại.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, organizationId, router]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && onboarding) {
      router.push(
        `/console/orgs/${encodeURIComponent(organizationId)}/api-keys`
      );
      return;
    }
    if (nextOpen) {
      setConfig(null);
      setForbidden(false);
      setError("");
      setLoading(true);
    }
    setOpen(nextOpen);
    if (!nextOpen && defaultOpen)
      router.replace(`/console/orgs/${encodeURIComponent(organizationId)}`, {
        scroll: false,
      });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <button className="console-primary-action" type="button">
          Cấu hình identity
        </button>
      </DialogTrigger>
      <DialogContent
        aria-describedby="organization-identity-description"
        className="identity-dialog"
      >
        <DialogHeader>
          <DialogTitle>Cấu hình identity · {organizationName}</DialogTitle>
          <DialogDescription id="organization-identity-description">
            Cung cấp issuer và public JWKS để AIHUB xác minh User Assertions.
          </DialogDescription>
        </DialogHeader>
        {loading && <p role="status">Đang tải cấu hình…</p>}
        {forbidden && (
          <p className="identity-safe-notice" role="status">
            Quyền truy cập Organization đã thay đổi. Không có issuer hoặc JWKS
            nào được hiển thị.
          </p>
        )}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {config && (
          <OrganizationIdentityForm
            initialConfig={config}
            onboarding={onboarding}
            organizationId={organizationId}
          />
        )}
        {!onboarding && (
          <Link
            className="identity-dialog-api-keys"
            href={`/console/orgs/${encodeURIComponent(organizationId)}/api-keys`}
          >
            Quản lý API keys
          </Link>
        )}
      </DialogContent>
    </Dialog>
  );
}
