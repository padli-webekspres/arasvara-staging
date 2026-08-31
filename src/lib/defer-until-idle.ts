/** Jadwalkan kerja non-kritis setelah idle, timeout, interaksi, atau tab disembunyikan. */

export const DEFER_IDLE_TIMEOUT_MS = 2500;

const INTERACT_EVENTS = [
  "scroll",
  "pointerdown",
  "keydown",
  "touchstart",
] as const;

export type DeferHost = {
  setTimeout: (handler: () => void, timeout?: number) => number;
  clearTimeout: (id: number) => void;
  addEventListener: (
    type: string,
    listener: () => void,
    options?: AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    type: string,
    listener: () => void,
    options?: AddEventListenerOptions,
  ) => void;
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (id: number) => void;
  document?: {
    visibilityState?: string;
    addEventListener: (
      type: string,
      listener: () => void,
      options?: AddEventListenerOptions,
    ) => void;
    removeEventListener: (
      type: string,
      listener: () => void,
      options?: AddEventListenerOptions,
    ) => void;
  };
};

/**
 * Menjalankan `run` sekali: idle (atau timeout), interaksi pertama,
 * atau saat dokumen hidden / pagehide (agar bounce analytics tetap terkirim).
 * Return cleanup — membatalkan jika belum jalan (unmount).
 */
export function scheduleDeferredWork(
  run: () => void,
  host: DeferHost,
  options?: { timeoutMs?: number },
): () => void {
  let settled = false;
  const timeoutMs = options?.timeoutMs ?? DEFER_IDLE_TIMEOUT_MS;

  const finish = () => {
    if (settled) return;
    settled = true;
    cleanup();
    run();
  };

  let idleId: number | undefined;
  let timeoutId: number | undefined;

  const onHidden = () => {
    if (host.document?.visibilityState === "hidden") finish();
  };

  if (typeof host.requestIdleCallback === "function") {
    idleId = host.requestIdleCallback(finish, { timeout: timeoutMs });
  } else {
    timeoutId = host.setTimeout(finish, timeoutMs);
  }

  for (const eventName of INTERACT_EVENTS) {
    host.addEventListener(eventName, finish, { once: true, passive: true });
  }
  host.document?.addEventListener("visibilitychange", onHidden);
  host.addEventListener("pagehide", finish);

  function cleanup() {
    if (idleId != null && typeof host.cancelIdleCallback === "function") {
      host.cancelIdleCallback(idleId);
    }
    if (timeoutId != null) host.clearTimeout(timeoutId);
    for (const eventName of INTERACT_EVENTS) {
      host.removeEventListener(eventName, finish);
    }
    host.document?.removeEventListener("visibilitychange", onHidden);
    host.removeEventListener("pagehide", finish);
  }

  return () => {
    if (settled) return;
    settled = true;
    cleanup();
  };
}
