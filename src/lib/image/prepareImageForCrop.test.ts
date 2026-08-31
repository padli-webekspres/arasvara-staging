import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareImageForCrop } from "./prepareImageForCrop";

function stubCanvas(drawImage = vi.fn()) {
  const toBlob = vi.fn((cb: BlobCallback) => {
    cb(new Blob(["jpeg"], { type: "image/jpeg" }));
  });
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage }),
    toBlob,
  };
  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      if (tag === "canvas") return canvas;
      throw new Error(`Unexpected element: ${tag}`);
    },
  });
  return { canvas, drawImage, toBlob };
}

describe("prepareImageForCrop", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("menghasilkan blob URL JPEG dari createImageBitmap + from-image", async () => {
    const close = vi.fn();
    const bitmap = {
      width: 4000,
      height: 3000,
      close,
    };

    const createImageBitmap = vi.fn().mockResolvedValue(bitmap);
    vi.stubGlobal("createImageBitmap", createImageBitmap);

    const { canvas, drawImage, toBlob } = stubCanvas();

    const createObjectURL = vi
      .fn()
      .mockReturnValue("blob:http://localhost/prepared");
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    });

    const file = new File([new Uint8Array([1, 2, 3])], "photo.jpg", {
      type: "image/jpeg",
    });

    const url = await prepareImageForCrop(file, { maxEdge: 2560 });

    expect(url).toBe("blob:http://localhost/prepared");
    expect(createImageBitmap).toHaveBeenCalledWith(file, {
      imageOrientation: "from-image",
    });
    expect(drawImage).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(canvas.width).toBe(2560);
    expect(canvas.height).toBe(1920);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.92);
  });

  it("mengulang createImageBitmap tanpa opsi jika from-image ditolak", async () => {
    const close = vi.fn();
    const bitmap = { width: 100, height: 100, close };
    const createImageBitmap = vi
      .fn()
      .mockRejectedValueOnce(new Error("bad option"))
      .mockResolvedValueOnce(bitmap);
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    stubCanvas();

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:http://localhost/prepared"),
      revokeObjectURL: vi.fn(),
    });

    const file = new File([new Uint8Array([1])], "photo.jpg", {
      type: "image/jpeg",
    });
    await prepareImageForCrop(file);

    expect(createImageBitmap).toHaveBeenNthCalledWith(1, file, {
      imageOrientation: "from-image",
    });
    expect(createImageBitmap).toHaveBeenNthCalledWith(2, file);
    expect(close).toHaveBeenCalled();
  });

  it("fallback Image() menghasilkan JPEG baru, bukan URL file asli", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockRejectedValue(new Error("unsupported")),
    );

    const revokeObjectURL = vi.fn();
    const createObjectURL = vi
      .fn()
      .mockReturnValueOnce("blob:http://localhost/raw")
      .mockReturnValueOnce("blob:http://localhost/jpeg");
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });

    stubCanvas();

    class FakeImage {
      naturalWidth = 4000;
      naturalHeight = 3000;
      onload: ((ev: Event) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.(new Event("load"));
        });
      }
    }
    vi.stubGlobal("Image", FakeImage);

    const file = new File([new Uint8Array([1])], "photo.heic", {
      type: "image/heic",
    });

    const url = await prepareImageForCrop(file, { maxEdge: 2560 });

    expect(url).toBe("blob:http://localhost/jpeg");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/raw");
  });

  it("me-revoke object URL fallback jika Image gagal load", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockRejectedValue(new Error("unsupported")),
    );

    const revokeObjectURL = vi.fn();
    const createObjectURL = vi
      .fn()
      .mockReturnValue("blob:http://localhost/raw");
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });

    class FakeImage {
      onload: ((ev: Event) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => {
          this.onerror?.(new Event("error"));
        });
      }
    }
    vi.stubGlobal("Image", FakeImage);

    const file = new File([new Uint8Array([1])], "bad.heic", {
      type: "image/heic",
    });

    await expect(prepareImageForCrop(file)).rejects.toThrow(
      /Failed to load image|Image load timeout/,
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/raw");
  });

  it("PNG diekspor PNG, bukan JPEG", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 100, height: 80, close }),
    );
    const { toBlob } = stubCanvas();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:http://localhost/png"),
      revokeObjectURL: vi.fn(),
    });

    const file = new File([new Uint8Array([1])], "logo.png", {
      type: "image/png",
    });
    await prepareImageForCrop(file);

    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/png",
      undefined,
    );
    expect(close).toHaveBeenCalled();
  });

  it("MIME kosong + magic PNG diekspor PNG", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 40, height: 40, close }),
    );
    const { toBlob } = stubCanvas();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:http://localhost/png"),
      revokeObjectURL: vi.fn(),
    });

    const pngMagic = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);
    const file = new File([pngMagic], "logo", { type: "" });
    await prepareImageForCrop(file);

    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/png",
      undefined,
    );
  });
});
