import { describe, expect, it } from "vitest";
import {
  S3_IMMUTABLE_CACHE_CONTROL,
  withImmutableCacheControl,
} from "@/lib/s3/object-cache";

describe("withImmutableCacheControl", () => {
  it("adds immutable cache control while preserving other fields", () => {
    const input = {
      Bucket: "arasvara-images",
      Key: "featured/sample.webp",
      ContentType: "image/webp",
    };

    expect(withImmutableCacheControl(input)).toEqual({
      ...input,
      CacheControl: S3_IMMUTABLE_CACHE_CONTROL,
    });
  });
});
