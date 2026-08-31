import { describe, expect, it, vi } from "vitest";
import {
  GTAG_SCRIPT_ID,
  injectGtagScript,
  installGtagStub,
  isGaMeasurementId,
} from "./load-gtag";

describe("isGaMeasurementId", () => {
  it("accepts GA4 measurement ids", () => {
    expect(isGaMeasurementId("G-7TZK76010Z")).toBe(true);
    expect(isGaMeasurementId("g-abc123")).toBe(true);
  });

  it("rejects empty or malformed ids", () => {
    expect(isGaMeasurementId("")).toBe(false);
    expect(isGaMeasurementId("UA-123")).toBe(false);
    expect(isGaMeasurementId("G-")).toBe(false);
  });
});

describe("installGtagStub", () => {
  it("queues config into dataLayer", () => {
    const win: { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } =
      {};
    installGtagStub("G-TEST", win);
    expect(typeof win.gtag).toBe("function");
    expect(win.dataLayer?.length).toBeGreaterThanOrEqual(2);
    win.gtag?.("event", "page_view", { page_path: "/" });
    const queued = win.dataLayer?.at(-1) as unknown as { 0: string; 1: string };
    expect(queued[0]).toBe("event");
    expect(queued[1]).toBe("page_view");
  });
});

describe("injectGtagScript", () => {
  it("appends an async script once", () => {
    const append = vi.fn();
    const existing: { id?: string } = {};
    const scriptEl = {
      id: "",
      async: false,
      src: "",
      onerror: null as (() => void) | null,
    };
    const doc = {
      getElementById: (id: string) => (id === existing.id ? existing : null),
      createElement: () => scriptEl,
      head: { appendChild: append },
    } as unknown as Document;

    injectGtagScript("G-ABC", doc);
    expect(scriptEl.id).toBe(GTAG_SCRIPT_ID);
    expect(scriptEl.async).toBe(true);
    expect(scriptEl.src).toContain("G-ABC");
    expect(append).toHaveBeenCalledOnce();

    existing.id = GTAG_SCRIPT_ID;
    injectGtagScript("G-ABC", doc);
    expect(append).toHaveBeenCalledOnce();
  });
});
