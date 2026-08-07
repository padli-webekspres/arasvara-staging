import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareImageForCrop } from "./prepareImageForCrop";

describe("prepareImageForCrop", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("menghasilkan blob URL JPEG dari createImageBitmap + canvas", async () => {
    const close = vi.fn();
    const bitmap = {
      width: 4000,
      height: 3000,
      close,
    };

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue(bitmap),
    );

    const drawImage = vi.fn();
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
    expect(createImageBitmap).toHaveBeenCalledWith(file);
    expect(drawImage).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(canvas.width).toBe(2560);
    expect(canvas.height).toBe(1920);
    expect(toBlob).toHaveBeenCalled();
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

    await expect(prepareImageForCrop(file)).rejects.toThrow();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/raw");
  });
});
