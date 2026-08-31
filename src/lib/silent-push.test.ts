import { describe, expect, it } from "vitest";
import { shouldMountSilentPush } from "./silent-push";

describe("shouldMountSilentPush", () => {
  it("is true only when permission is already granted", () => {
    expect(shouldMountSilentPush("granted")).toBe(true);
    expect(shouldMountSilentPush("default")).toBe(false);
    expect(shouldMountSilentPush("denied")).toBe(false);
    expect(shouldMountSilentPush(undefined)).toBe(false);
  });
});
