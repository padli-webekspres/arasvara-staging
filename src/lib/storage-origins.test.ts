import { afterEach, describe, expect, it } from "vitest";
import { getPublicStorageOrigins } from "@/lib/storage-origins";

const ORIGINAL_MEDIA = process.env.NEXT_PUBLIC_STORAGE_MEDIA;
const ORIGINAL_CONFIG = process.env.NEXT_PUBLIC_STORAGE_CONFIGURATION;

afterEach(() => {
  process.env.NEXT_PUBLIC_STORAGE_MEDIA = ORIGINAL_MEDIA;
  process.env.NEXT_PUBLIC_STORAGE_CONFIGURATION = ORIGINAL_CONFIG;
});

describe("getPublicStorageOrigins", () => {
  it("returns unique public origins", () => {
    process.env.NEXT_PUBLIC_STORAGE_MEDIA = "https://media.arasvara.id/assets";
    process.env.NEXT_PUBLIC_STORAGE_CONFIGURATION =
      "https://configuration.arasvara.id/files";

    expect(getPublicStorageOrigins()).toEqual([
      "https://media.arasvara.id",
      "https://configuration.arasvara.id",
    ]);
  });

  it("filters localhost and private network hosts", () => {
    process.env.NEXT_PUBLIC_STORAGE_MEDIA = "http://localhost:9000";
    process.env.NEXT_PUBLIC_STORAGE_CONFIGURATION = "http://192.168.1.10:9001";

    expect(getPublicStorageOrigins()).toEqual([]);
  });
});
