import { describe, expect, it } from "vitest";
import {
  normalizeArticleTitle,
  isPlaceholderArticleTitle,
  resolveArticleSlug,
  titleNormalizedForStorage,
  validateArticleForPublish,
  validateArticleForApproval,
} from "@/lib/article-validation";
import { ObjectId } from "mongodb";

describe("normalizeArticleTitle", () => {
  it("lowercase + strip punctuation + collapse whitespace", () => {
    expect(normalizeArticleTitle("  Artikel: Berita Terbaru!  ")).toBe(
      "artikel berita terbaru",
    );
    expect(normalizeArticleTitle("COVID-19 & Vaksin")).toBe("covid19 vaksin");
  });

  it("NFKD normalisasi lowercase", () => {
    // Implementation lowercase + NFKD tapi tidak strip combining marks
    // café (precomposed) → café (decomposed e + combining acute)
    expect(normalizeArticleTitle("Café")).toMatch(/caf/);
    expect(normalizeArticleTitle("naïve")).toMatch(/na.*ve/);
  });

  it("hapus emoji dan simbol", () => {
    expect(normalizeArticleTitle("Breaking 🔥 News!")).toBe("breaking news");
  });
});

describe("isPlaceholderArticleTitle", () => {
  it("true untuk kosong atau 'Untitled'", () => {
    expect(isPlaceholderArticleTitle("")).toBe(true);
    expect(isPlaceholderArticleTitle("   ")).toBe(true);
    expect(isPlaceholderArticleTitle("Untitled")).toBe(true);
    expect(isPlaceholderArticleTitle("untitled")).toBe(true);
    expect(isPlaceholderArticleTitle("  UNTITLED  ")).toBe(true);
  });

  it("false untuk judul real", () => {
    expect(isPlaceholderArticleTitle("Breaking News")).toBe(false);
    expect(isPlaceholderArticleTitle("Untitled Story")).toBe(false);
  });
});

describe("resolveArticleSlug", () => {
  it("judul placeholder → slug dengan ObjectId", () => {
    const oid = new ObjectId();
    const slug = resolveArticleSlug("", oid);
    expect(slug).toMatch(/^untitled-[a-f0-9]{24}$/);
  });

  it("judul normal → slug biasa", () => {
    const slug = resolveArticleSlug("Breaking News Today");
    expect(slug).toBe("breaking-news-today");
  });
});

describe("titleNormalizedForStorage", () => {
  it("null untuk placeholder", () => {
    expect(titleNormalizedForStorage("")).toBeNull();
    expect(titleNormalizedForStorage("Untitled")).toBeNull();
  });

  it("normalized string untuk real title", () => {
    expect(titleNormalizedForStorage("Breaking News!")).toBe("breaking news");
  });
});

describe("validateArticleForPublish", () => {
  it("GALLERY: valid jika ada 1+ items", () => {
    const result = validateArticleForPublish({
      format: "GALLERY",
      galleryItems: [{ mediaId: "123" }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("GALLERY: invalid jika galleryItems kosong", () => {
    const result = validateArticleForPublish({
      format: "GALLERY",
      galleryItems: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Gallery article harus memiliki minimal 1 gambar",
    );
  });

  it("GALLERY: invalid jika galleryItems undefined", () => {
    const result = validateArticleForPublish({
      format: "GALLERY",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("STANDARD: always valid (content optional for draft)", () => {
    const result = validateArticleForPublish({
      format: "STANDARD",
      content: "",
    });
    expect(result.valid).toBe(true);
  });
});

describe("validateArticleForApproval", () => {
  it("GALLERY: valid jika ada 1+ items", () => {
    const result = validateArticleForApproval({
      format: "GALLERY",
      galleryItems: [{ mediaId: "123" }],
      status: "PUBLISHED",
    });
    expect(result.valid).toBe(true);
  });

  it("GALLERY: invalid jika empty saat approval", () => {
    const result = validateArticleForApproval({
      format: "GALLERY",
      galleryItems: [],
      status: "PUBLISHED",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Gallery article harus memiliki minimal 1 gambar sebelum dipublikasikan",
    );
  });

  it("STANDARD: valid tanpa gallery items", () => {
    const result = validateArticleForApproval({
      format: "STANDARD",
      status: "PUBLISHED",
    });
    expect(result.valid).toBe(true);
  });

  it("default format ke STANDARD jika undefined", () => {
    const result = validateArticleForApproval({
      galleryItems: [],
      status: "PUBLISHED",
    });
    expect(result.valid).toBe(true);
  });
});
