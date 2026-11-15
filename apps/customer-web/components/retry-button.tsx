"use client";

import { useRouter } from "next/navigation";

/**
 * Asks the server for the page again. It is an action, not a destination, so
 * it is a button: an empty `href` reads to assistive technology as a link to
 * nowhere.
 */
export function RetryButton() {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.refresh()}>
      Thử lại
    </button>
  );
}
