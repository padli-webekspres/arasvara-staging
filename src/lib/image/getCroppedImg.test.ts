import { describe, expect, it } from "vitest";
import { toNaturalPixelCrop } from "@/lib/image/getCroppedImg";

/** Buat objek minimal yang memenuhi interface yang dibutuhkan toNaturalPixelCrop. */
function makeImg(
  naturalWidth: number,
  naturalHeight: number,
  displayWidth: number,
  displayHeight: number,
) {
  return { naturalWidth, naturalHeight, width: displayWidth, height: displayHeight } as HTMLImageElement;
}

describe("toNaturalPixelCrop", () => {
  it("identity saat gambar ditampilkan di ukuran natural", () => {
    const img = makeImg(1920, 1080, 1920, 1080);
    const result = toNaturalPixelCrop(img, { x: 100, y: 50, width: 400, height: 300 });
    expect(result).toEqual({ x: 100, y: 50, width: 400, height: 300 });
  });

  it("scale koordinat saat gambar ditampilkan lebih kecil", () => {
    // Gambar 1920×1080 ditampilkan sebagai 480×270 (skala 0.25)
    const img = makeImg(1920, 1080, 480, 270);
    const result = toNaturalPixelCrop(img, { x: 48, y: 27, width: 192, height: 108 });
    expect(result).toEqual({ x: 192, y: 108, width: 768, height: 432 });
  });

  it("scale non-uniform (aspect berbeda saat fit contain)", () => {
    // Gambar 800×600 ditampilkan sebagai 400×200 (scaleX=2, scaleY=3)
    const img = makeImg(800, 600, 400, 200);
    const result = toNaturalPixelCrop(img, { x: 10, y: 10, width: 200, height: 100 });
    expect(result).toEqual({ x: 20, y: 30, width: 400, height: 300 });
  });

  it("membulatkan ke integer terdekat", () => {
    // scaleX = scaleY = 3
    const img = makeImg(1920, 1080, 640, 360);
    const result = toNaturalPixelCrop(img, { x: 7, y: 3, width: 100, height: 60 });
    expect(result).toEqual({ x: 21, y: 9, width: 300, height: 180 });
  });

  it("menangani gambar portrait 4:5 dengan benar", () => {
    // Gambar 1200×1500 ditampilkan sebagai 320×400 (scaleX = scaleY = 3.75)
    const img = makeImg(1200, 1500, 320, 400);
    const result = toNaturalPixelCrop(img, { x: 16, y: 20, width: 288, height: 360 });
    expect(result).toEqual({ x: 60, y: 75, width: 1080, height: 1350 });
  });
});
