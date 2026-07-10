const WATERMARK_OPACITY = 0.5;
const WATERMARK_WIDTH_RATIO = 0.25; // 25% lebar gambar (lebih kecil)
import { BRAND_LOGO } from "@/lib/brand-logos";

const WATERMARK_DARK = BRAND_LOGO.mainLight; // untuk gambar gelap
const WATERMARK_BRIGHT = BRAND_LOGO.mainDark; // untuk gambar cerah
const BRIGHTNESS_THRESHOLD = 128; // 0-255, di atas ini = cerah
const SAMPLE_STEP = 10; // sampling setiap N pixel untuk performa

/**
 * Hitung rata-rata luminance gambar dari canvas.
 * Sampling setiap SAMPLE_STEP pixel untuk efisiensi.
 * @returns nilai 0–255, semakin besar semakin cerah
 */
function getAverageLuminance(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): number {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let total = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4 * SAMPLE_STEP) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Formula luminance standar (ITU-R BT.601)
    total += 0.299 * r + 0.587 * g + 0.114 * b;
    count++;
  }
  return count > 0 ? total / count : 128;
}

/**
 * Deteksi apakah gambar mayoritas cerah atau gelap,
 * dan kembalikan URL watermark yang sesuai.
 */
export function detectWatermarkUrl(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): string {
  const lum = getAverageLuminance(ctx, width, height);
  return lum > BRIGHTNESS_THRESHOLD ? WATERMARK_BRIGHT : WATERMARK_DARK;
}

/**
 * Embed watermark image ke tengah gambar (horizontal & vertikal) dengan opacity 20%.
 * Watermark dipilih otomatis berdasarkan kecerahan gambar:
 * - Gambar cerah → watermark hitam
 * - Gambar gelap → watermark putih
 * @param mainFile File (image) to be watermarked
 * @param options { opacity: number (0-1) }
 * @returns Promise<File> watermarked image as File (WebP)
 */
export async function embedWatermarkToImage(
  mainFile: File,
  options?: { opacity?: number; webpQuality?: number },
): Promise<File> {
  const { opacity = WATERMARK_OPACITY, webpQuality = 0.85 } = options || {};
  try {
    // Load main image
    const mainImg = await loadImageFromFile(mainFile);

    // Create canvas dengan ukuran sama dengan gambar asli
    const canvas = document.createElement("canvas");
    canvas.width = mainImg.width;
    canvas.height = mainImg.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available");

    // Draw main image
    ctx.drawImage(mainImg, 0, 0, canvas.width, canvas.height);

    // Deteksi kecerahan dan pilih watermark yang sesuai
    const watermarkUrl = detectWatermarkUrl(ctx, canvas.width, canvas.height);

    // Load watermark image sesuai kecerahan gambar
    const watermarkImg = await loadImageFromUrl(watermarkUrl);

    // Watermark: 25% lebar gambar, di pojok kanan atas dengan padding 5%
    const padding = Math.floor(canvas.width * 0.05);
    const wmWidth = Math.floor(canvas.width * WATERMARK_WIDTH_RATIO);
    const wmHeight = Math.floor(
      (watermarkImg.height / watermarkImg.width) * wmWidth,
    );
    const wmX = canvas.width - wmWidth - padding;
    const wmY = padding * 2;
    ctx.globalAlpha = opacity;
    ctx.drawImage(watermarkImg, wmX, wmY, wmWidth, wmHeight);
    ctx.globalAlpha = 1;

    // Convert to WebP blob via native canvas
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/webp",
        webpQuality,
      ),
    );
    return new File(
      [blob],
      mainFile.name.replace(/\.[^.]+$/, "") + "-wm.webp",
      { type: "image/webp" },
    );
  } catch (err) {
    // Log error for debugging
    console.error("[embedWatermarkToImage] ERROR:", err);
    throw err;
  }
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Validasi dimensi watermark
      if (img.width === 0 || img.height === 0) {
        reject(new Error("Watermark image failed to load or has no size"));
      } else {
        resolve(img);
      }
    };
    img.onerror = (e) => {
      console.error(
        "[embedWatermarkToImage] ERROR loading watermark image:",
        url,
        e,
      );
      reject(new Error("Failed to load watermark image: " + url));
    };
    img.src = url;
  });
}
