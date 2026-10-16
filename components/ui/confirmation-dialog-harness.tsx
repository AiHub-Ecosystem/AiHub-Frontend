"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

type Outcome = "success" | "false" | "reject";

export function ConfirmationDialogHarness() {
  const [parentOpen, setParentOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("success");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const nestedConfirmationOpen = useRef(false);

  function handleParentOpenChange(nextOpen: boolean) {
    // The confirmation owns Escape until it is down. See ConfirmationDialog.
    if (!nextOpen && nestedConfirmationOpen.current) return;
    setParentOpen(nextOpen);
  }

  async function confirm() {
    setAttempts((count) => count + 1);
    setPending(true);
    setError("");
    try {
      const result = await new Promise<Outcome>((resolve, reject) => {
        setTimeout(() => {
          if (outcome === "reject") reject(new Error("REQUEST_FAILED"));
          else resolve(outcome);
        }, 900);
      });
      if (result === "success") setConfirmationOpen(false);
      else setError("The action was not accepted.");
    } catch {
      setError("The action could not be completed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="confirmation-dialog-test-harness">
      <Dialog onOpenChange={handleParentOpenChange} open={parentOpen}>
        <DialogTrigger asChild>
          <button type="button">Open parent dialog</button>
        </DialogTrigger>
        <DialogContent aria-describedby="confirmation-parent-description">
          <DialogHeader>
            <DialogTitle>Parent dialog</DialogTitle>
            <DialogDescription id="confirmation-parent-description">
              The parent stays open while its confirmation is shown.
            </DialogDescription>
          </DialogHeader>
          <label>
            Confirmation outcome
            <select
              onChange={(event) => setOutcome(event.target.value as Outcome)}
              value={outcome}
            >
              <option value="success">Success</option>
              <option value="false">Return false</option>
              <option value="reject">Reject</option>
            </select>
          </label>
          <p>
            Attempts:{" "}
            <output aria-label="Confirmation attempts">{attempts}</output>
          </p>
          <ConfirmationDialog
            body={
              <>
                <p>
                  This will permanently remove the{" "}
                  <strong>sample record</strong>.
                </p>
                {error && <p role="alert">{error}</p>}
              </>
            }
            cancelLabel="Cancel"
            confirmLabel="Delete"
            destructive
            onConfirm={confirm}
            onOpenChange={(open) => {
              nestedConfirmationOpen.current = open;
              setConfirmationOpen(open);
              if (open) setError("");
            }}
            open={confirmationOpen}
            pending={pending}
            pendingLabel="Deleting…"
            title={
              <>
                Remove <strong>record</strong>?
              </>
            }
            trigger={<button type="button">Open nested confirmation</button>}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}
