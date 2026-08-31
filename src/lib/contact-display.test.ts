import { describe, expect, it } from "vitest";
import {
  buildFooterNap,
  formatPhoneDisplay,
  phoneTelHref,
} from "./contact-display";

describe("formatPhoneDisplay", () => {
  it("normalizes 62 / 0 / +62 prefixes", () => {
    expect(formatPhoneDisplay("628123456789")).toBe("+62 8123456789");
    expect(formatPhoneDisplay("08123456789")).toBe("+62 8123456789");
    expect(formatPhoneDisplay("+628123456789")).toBe("+62 8123456789");
  });

  it("returns empty for blank", () => {
    expect(formatPhoneDisplay("")).toBe("");
    expect(formatPhoneDisplay("   ")).toBe("");
  });
});

describe("phoneTelHref", () => {
  it("builds tel:+62 from stored or display numbers", () => {
    expect(phoneTelHref("628123456789")).toBe("tel:+628123456789");
    expect(phoneTelHref("+62 8123456789")).toBe("tel:+628123456789");
    expect(phoneTelHref("08123456789")).toBe("tel:+628123456789");
  });
});

describe("buildFooterNap", () => {
  it("returns both fields when present", () => {
    expect(buildFooterNap("Jl. Contoh 1", "62811")).toEqual({
      address: "Jl. Contoh 1",
      phone: "+62 811",
      phoneHref: "tel:+62811",
    });
  });

  it("returns address only", () => {
    expect(buildFooterNap("Jl. Contoh 1", "")).toEqual({
      address: "Jl. Contoh 1",
    });
  });

  it("returns null when both empty", () => {
    expect(buildFooterNap("  ", "")).toBeNull();
    expect(buildFooterNap(undefined, undefined)).toBeNull();
  });
});
