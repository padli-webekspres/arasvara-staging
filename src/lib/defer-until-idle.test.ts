import { describe, expect, it, vi } from "vitest";
import { scheduleDeferredWork } from "./defer-until-idle";

function createHost() {
  const listeners = new Map<string, Set<() => void>>();
  const docListeners = new Map<string, Set<() => void>>();
  let timeoutHandler: (() => void) | null = null;
  let idleHandler: (() => void) | null = null;
  let visibilityState = "visible";

  const host = {
    setTimeout: (handler: () => void) => {
      timeoutHandler = handler;
      return 1;
    },
    clearTimeout: () => {
      timeoutHandler = null;
    },
    addEventListener: (type: string, listener: () => void) => {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener: (type: string, listener: () => void) => {
      listeners.get(type)?.delete(listener);
    },
    requestIdleCallback: (callback: () => void) => {
      idleHandler = callback;
      return 7;
    },
    cancelIdleCallback: () => {
      idleHandler = null;
    },
    document: {
      get visibilityState() {
        return visibilityState;
      },
      addEventListener: (type: string, listener: () => void) => {
        const set = docListeners.get(type) ?? new Set();
        set.add(listener);
        docListeners.set(type, set);
      },
      removeEventListener: (type: string, listener: () => void) => {
        docListeners.get(type)?.delete(listener);
      },
    },
    emit(type: string) {
      for (const listener of listeners.get(type) ?? []) listener();
    },
    emitDoc(type: string) {
      for (const listener of docListeners.get(type) ?? []) listener();
    },
    hide() {
      visibilityState = "hidden";
      this.emitDoc("visibilitychange");
    },
    runIdle() {
      idleHandler?.();
    },
    runTimeout() {
      timeoutHandler?.();
    },
  };

  return host;
}

describe("scheduleDeferredWork", () => {
  it("runs on idle callback", () => {
    const run = vi.fn();
    const host = createHost();
    scheduleDeferredWork(run, host);
    expect(run).not.toHaveBeenCalled();
    host.runIdle();
    expect(run).toHaveBeenCalledOnce();
  });

  it("runs on first interaction", () => {
    const run = vi.fn();
    const host = createHost();
    scheduleDeferredWork(run, host);
    host.emit("scroll");
    expect(run).toHaveBeenCalledOnce();
    host.emit("pointerdown");
    expect(run).toHaveBeenCalledOnce();
  });

  it("runs when the document becomes hidden", () => {
    const run = vi.fn();
    const host = createHost();
    scheduleDeferredWork(run, host);
    host.hide();
    expect(run).toHaveBeenCalledOnce();
  });

  it("runs on pagehide", () => {
    const run = vi.fn();
    const host = createHost();
    scheduleDeferredWork(run, host);
    host.emit("pagehide");
    expect(run).toHaveBeenCalledOnce();
  });

  it("cleanup before run prevents the callback", () => {
    const run = vi.fn();
    const host = createHost();
    const cancel = scheduleDeferredWork(run, host);
    cancel();
    host.runIdle();
    host.emit("scroll");
    expect(run).not.toHaveBeenCalled();
  });

  it("falls back to setTimeout when idle callback is missing", () => {
    const run = vi.fn();
    const host = createHost();
    const { requestIdleCallback, cancelIdleCallback, ...rest } = host;
    void requestIdleCallback;
    void cancelIdleCallback;
    scheduleDeferredWork(run, rest);
    rest.runTimeout();
    expect(run).toHaveBeenCalledOnce();
  });
});
