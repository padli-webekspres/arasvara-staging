import { describe, expect, it } from "vitest";
import { cropOutputFromAspect } from "./cropOutputFromAspect";

describe("cropOutputFromAspect", () => {
  it("landscape 728/90: sisi terpanjang 1920", () => {
    expect(cropOutputFromAspect(728 / 90)).toEqual({
      width: 1920,
      height: 237,
    });
  });

  it("portrait 9/16: sisi terpanjang 1920", () => {
    expect(cropOutputFromAspect(9 / 16)).toEqual({
      width: 1080,
      height: 1920,
    });
  });

  it("square 1: 1920×1920", () => {
    expect(cropOutputFromAspect(1)).toEqual({
      width: 1920,
      height: 1920,
    });
  });
});
