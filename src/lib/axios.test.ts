import { describe, expect, it } from "vitest";
import { shouldRedirectToCmsLogin } from "@/lib/axios";

describe("shouldRedirectToCmsLogin", () => {
  it("matches the CMS base path and nested routes", () => {
    expect(shouldRedirectToCmsLogin("/admin-xyz", "/admin-xyz")).toBe(true);
    expect(
      shouldRedirectToCmsLogin("/admin-xyz/analytics", "/admin-xyz"),
    ).toBe(true);
  });

  it("does not match public pages or similar prefixes", () => {
    expect(shouldRedirectToCmsLogin("/login", "/admin-xyz")).toBe(false);
    expect(shouldRedirectToCmsLogin("/", "/admin-xyz")).toBe(false);
    expect(shouldRedirectToCmsLogin("/admin-xyz-extra", "/admin-xyz")).toBe(
      false,
    );
  });
});
