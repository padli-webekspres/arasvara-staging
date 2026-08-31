import { describe, expect, it } from "vitest";
import { shouldUseSecureAuthCookies, cookieJarHasAuthSession } from "@/lib/auth-config";

describe("shouldUseSecureAuthCookies", () => {
  it("follows AUTH_COOKIE_SECURE override", () => {
    expect(shouldUseSecureAuthCookies({ AUTH_COOKIE_SECURE: "true" })).toBe(
      true,
    );
    expect(shouldUseSecureAuthCookies({ AUTH_COOKIE_SECURE: "false" })).toBe(
      false,
    );
  });

  it("is false for HTTP LAN even when NODE_ENV is production", () => {
    expect(
      shouldUseSecureAuthCookies({
        NODE_ENV: "production",
        NEXT_PUBLIC_BASE_URL: "http://192.168.0.193:3000",
      }),
    ).toBe(false);
  });

  it("is true for HTTPS production URL", () => {
    expect(
      shouldUseSecureAuthCookies({
        NODE_ENV: "production",
        NEXT_PUBLIC_BASE_URL: "https://arasvara.id",
      }),
    ).toBe(true);
  });
});

describe("cookieJarHasAuthSession", () => {
  it("is true when any auth cookie is present", () => {
    expect(
      cookieJarHasAuthSession((name) =>
        name === "refresh_token" ? "raw" : undefined,
      ),
    ).toBe(true);
  });

  it("is false when cookies are missing or blank", () => {
    expect(cookieJarHasAuthSession(() => undefined)).toBe(false);
    expect(cookieJarHasAuthSession(() => "  ")).toBe(false);
  });
});
