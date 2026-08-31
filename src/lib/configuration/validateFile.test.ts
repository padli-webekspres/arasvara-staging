import { describe, expect, it } from "vitest";
import { validateConfigurationFile } from "./validateFile";

function jpegFile(name: string, type: string) {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  return new File([bytes], name, { type });
}

describe("validateConfigurationFile", () => {
  it("menerima JPEG dengan MIME kosong (Safari/IDB)", async () => {
    const result = await validateConfigurationFile(
      jpegFile("bg.jpg", ""),
      "fotografi_section_bg",
    );
    expect(result).toEqual({ isValid: true });
  });

  it("menerima image/jpeg", async () => {
    const result = await validateConfigurationFile(
      jpegFile("bg.jpg", "image/jpeg"),
      "fotografi_section_bg",
    );
    expect(result).toEqual({ isValid: true });
  });

  it("menolak SVG", async () => {
    const result = await validateConfigurationFile(
      new File([new Uint8Array(12)], "x.svg", { type: "image/svg+xml" }),
      "fotografi_section_bg",
    );
    expect(result.isValid).toBe(false);
  });

  it("menolak buffer bukan gambar jika MIME kosong", async () => {
    const result = await validateConfigurationFile(
      new File([new Uint8Array(12)], "x.bin", { type: "" }),
      "fotografi_section_bg",
    );
    expect(result.isValid).toBe(false);
  });
});
