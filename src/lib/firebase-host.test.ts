import { describe, expect, it } from "vitest";
import {
  isLocalFirebaseDevHost,
  isSecurePushContext,
  getPushEnvironmentIssue,
} from "@/lib/firebase-host";

describe("isLocalFirebaseDevHost", () => {
  it("returns true for localhost and LAN dev hosts", () => {
    expect(isLocalFirebaseDevHost("localhost")).toBe(true);
    expect(isLocalFirebaseDevHost("127.0.0.1")).toBe(true);
    expect(isLocalFirebaseDevHost("192.168.0.228")).toBe(true);
  });

  it("returns false for production hostnames", () => {
    expect(isLocalFirebaseDevHost("arasvara.id")).toBe(false);
    expect(isLocalFirebaseDevHost("demoarasvara.vercel.app")).toBe(false);
  });
});

describe("isSecurePushContext", () => {
  it("returns false when window is undefined", () => {
    expect(isSecurePushContext()).toBe(false);
  });
});

describe("getPushEnvironmentIssue", () => {
  it("returns null when window is undefined", () => {
    expect(getPushEnvironmentIssue()).toBeNull();
  });
});
