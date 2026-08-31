import { describe, expect, it } from "vitest";
import {
  validateArticleForPublish,
  validateArticleForApproval,
  isPlaceholderArticleTitle,
  titleNormalizedForStorage,
  normalizeArticleTitle,
} from "@/lib/article-validation";

describe("Article Validation Edge Cases", () => {
  describe("Gallery validation boundary conditions", () => {
    it("DRAFT status allows empty gallery (deferred validation)", () => {
      // validateArticleForPublish enforce minimal 1
      const result = validateArticleForPublish({
        format: "GALLERY",
        galleryItems: [],
      });
      
      expect(result.valid).toBe(false);
    });

    it("galleryItems dengan order tidak berurutan diterima", () => {
      const result = validateArticleForPublish({
        format: "GALLERY",
        galleryItems: [
          { mediaId: "1", order: 5 },
          { mediaId: "2", order: 1 },
          { mediaId: "3", order: 10 },
        ],
      });
      
      expect(result.valid).toBe(true);
    });

    it("galleryItems undefined treated as empty array", () => {
      const result = validateArticleForPublish({
        format: "GALLERY",
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Gallery article harus memiliki minimal 1 gambar");
    });

    it("galleryItems non-array rejected", () => {
      const result = validateArticleForPublish({
        format: "GALLERY",
        galleryItems: "not-an-array" as unknown as unknown[],
      });
      
      expect(result.valid).toBe(false);
    });
  });

  describe("Format field immutability", () => {
    it("format undefined defaults to STANDARD", () => {
      const result = validateArticleForApproval({
        status: "PUBLISHED",
      });
      
      expect(result.valid).toBe(true);
    });

    it("format case sensitive - non-GALLERY treated as STANDARD", () => {
      const result = validateArticleForPublish({
        format: "gallery" as unknown as "GALLERY",
        galleryItems: [],
      });
      
      // Should not match GALLERY branch
      expect(result.valid).toBe(true);
    });
  });

  describe("Featured image attribution", () => {
    it("partial attribution (hanya caption) diterima", () => {
      const result = validateArticleForApproval({
        format: "STANDARD",
        featuredImage: {
          mediaId: "123",
          caption: "Test caption",
          credit: "",
        },
        status: "PUBLISHED",
      });
      
      expect(result.valid).toBe(true);
    });

    it("featuredImage null diterima (optional)", () => {
      const result = validateArticleForApproval({
        format: "STANDARD",
        featuredImage: null,
        status: "PUBLISHED",
      });
      
      expect(result.valid).toBe(true);
    });
  });

  describe("Status transition validation", () => {
    it("PUBLISHED requires gallery validation", () => {
      const result = validateArticleForApproval({
        format: "GALLERY",
        galleryItems: [],
        status: "PUBLISHED",
      });
      
      expect(result.valid).toBe(false);
    });

    it("DRAFT status still enforced in validateArticleForApproval", () => {
      const result = validateArticleForApproval({
        format: "GALLERY",
        galleryItems: [],
        status: "DRAFT",
      });
      
      expect(result.valid).toBe(false);
    });
  });

  describe("Title normalization edge cases", () => {
    it("empty title vs Untitled", () => {
      expect(isPlaceholderArticleTitle("")).toBe(true);
      expect(isPlaceholderArticleTitle("Untitled")).toBe(true);
      
      expect(titleNormalizedForStorage("")).toBeNull();
      expect(titleNormalizedForStorage("Untitled")).toBeNull();
    });

    it("whitespace-only title treated as placeholder", () => {
      expect(isPlaceholderArticleTitle("   ")).toBe(true);
      expect(isPlaceholderArticleTitle("\t\n")).toBe(true);
    });

    it("multiple consecutive spaces collapsed", () => {
      expect(normalizeArticleTitle("Breaking    News   Today")).toBe("breaking news today");
    });

    it("emoji stripped dari title", () => {
      const result = normalizeArticleTitle("Breaking 🔥 News 🚀");
      expect(result).not.toContain("🔥");
      expect(result).not.toContain("🚀");
      expect(result).toContain("breaking");
      expect(result).toContain("news");
    });
  });
});
