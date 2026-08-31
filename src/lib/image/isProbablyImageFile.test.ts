import { describe, expect, it } from "vitest";
import { IMAGE_DROPZONE_ACCEPT } from "./isProbablyImageFile";
import { IMAGE_PROCESS_TEMP_TIMEOUT_MS } from "./uploadTimeout";

describe("image upload constants", () => {
  it("tidak menerima GIF di dropzone", () => {
    const exts = IMAGE_DROPZONE_ACCEPT["image/*"];
    expect(exts).not.toContain(".gif");
    expect(exts).toContain(".heic");
  });

  it("process-temp timeout 120 detik", () => {
    expect(IMAGE_PROCESS_TEMP_TIMEOUT_MS).toBe(120_000);
  });
});
