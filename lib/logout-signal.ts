/**
 * Carries no secret: the value is a timestamp, and a tab that hears it drops
 * whatever it holds in memory rather than sending anything anywhere.
 */
const LOGOUT_SIGNAL = "aihub:logout";

/** Tells the other tabs a Web Session ended. */
export function broadcastLogout() {
  window.localStorage.setItem(LOGOUT_SIGNAL, String(Date.now()));
}

export function isLogoutSignal(event: StorageEvent) {
  return event.key === LOGOUT_SIGNAL;
}
