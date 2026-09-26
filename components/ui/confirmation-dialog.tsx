"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRef, type ReactElement, type ReactNode } from "react";

export function ConfirmationDialog({
  open,
  onOpenChange,
  trigger,
  title,
  body,
  cancelLabel,
  confirmLabel,
  pendingLabel,
  pending = false,
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  title: ReactNode;
  body: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  pendingLabel: string;
  pending?: boolean;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);

  async function handleConfirm() {
    if (pending || submitting.current) return;
    submitting.current = true;
    try {
      await onConfirm();
    } finally {
      submitting.current = false;
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return;
    onOpenChange(nextOpen);
  }

  return (
    <DialogPrimitive.Root onOpenChange={handleOpenChange} open={open}>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="confirmation-dialog-overlay" />
        <DialogPrimitive.Content
          className="ui-dialog-content confirmation-dialog-content"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelButton.current?.focus();
          }}
          onPointerDownOutside={(event) => {
            if (pending) event.preventDefault();
          }}
          role="alertdialog"
        >
          <DialogPrimitive.Title className="ui-dialog-title">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description asChild>
            <div className="confirmation-dialog-body">{body}</div>
          </DialogPrimitive.Description>
          <div className="confirmation-dialog-actions">
            <DialogPrimitive.Close asChild>
              <button
                className="confirmation-dialog-button"
                disabled={pending}
                ref={cancelButton}
                type="button"
              >
                {cancelLabel}
              </button>
            </DialogPrimitive.Close>
            <button
              className={`confirmation-dialog-button${
                destructive ? " confirmation-dialog-button--destructive" : ""
              }`}
              disabled={pending}
              onClick={handleConfirm}
              type="button"
            >
              {pending ? pendingLabel : confirmLabel}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
