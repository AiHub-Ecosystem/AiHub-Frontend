import { RetryButton } from "@/components/retry-button";

export function RosterUnavailable() {
  return (
    <main className="aihub auth-page console-page">
      <div className="aihub-shell">
        <h1 className="aihub-title">Không thể tải Organization</h1>
        <RetryButton />
      </div>
    </main>
  );
}
