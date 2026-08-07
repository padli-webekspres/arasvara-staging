import { describe, expect, it } from "vitest";
import {
  buildTempMediaKey,
  buildTempMediaViewUrl,
  isValidTempMediaId,
  TEMP_MEDIA_FOLDER,
} from "@/lib/media/tempMedia";

describe("tempMedia helpers", () => {
  it("builds a temp object key with the temp/ prefix", () => {
    expect(buildTempMediaKey("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(
      `${TEMP_MEDIA_FOLDER}/01ARZ3NDEKTSV4RRFFQ69G5FAV.webp`,
    );
  });

  it("builds a view URL with an encoded key", () => {
    const url = buildTempMediaViewUrl("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(url).toBe(
      `/api/media/view?key=${encodeURIComponent(
        `${TEMP_MEDIA_FOLDER}/01ARZ3NDEKTSV4RRFFQ69G5FAV.webp`,
      )}`,
    );
    expect(url).toContain("temp%2F");
  });

  it("accepts valid temp media ids", () => {
    expect(isValidTempMediaId("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(true);
  });

  it("rejects ids with path traversal or invalid characters", () => {
    expect(isValidTempMediaId("")).toBe(false);
    expect(isValidTempMediaId("../etc/passwd")).toBe(false);
    expect(isValidTempMediaId("a/b")).toBe(false);
    expect(isValidTempMediaId("a b")).toBe(false);
    expect(isValidTempMediaId(undefined)).toBe(false);
    expect(isValidTempMediaId(null)).toBe(false);
    expect(isValidTempMediaId(123)).toBe(false);
  });
});
