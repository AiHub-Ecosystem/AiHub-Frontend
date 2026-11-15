import { notFound } from "next/navigation";
import { ConfirmationDialogHarness } from "@/components/ui/confirmation-dialog-harness";
import "../../auth.css";

export const dynamic = "force-dynamic";

export default function ConfirmationDialogTestPage() {
  if (process.env.E2E_TESTING !== "1") notFound();
  return <ConfirmationDialogHarness />;
}
