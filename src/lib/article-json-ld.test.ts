import { describe, expect, it } from "vitest";
import { buildArticleNewsArticleJsonLd } from "@/lib/article-json-ld";
import { ArticleStatus, type Article } from "@/types/article";

function sampleArticle(overrides: Partial<Article> = {}): Article {
  return {
    _id: "abc",
    title: "Judul Tes",
    slug: "judul-tes",
    excerpt: "Ringkasan",
    categoryId: "cat1",
    category: {
      _id: "cat1",
      name: "Entertainment",
      slug: "entertainment",
    } as Article["category"],
    tags: [],
    authorId: "u1",
    author: {
      _id: "u1",
      name: "Penulis",
      slug: "penulis",
      role: "WRITER",
    } as Article["author"],
    status: ArticleStatus.PUBLISHED,
    viewCount: 0,
    publishedAt: new Date("2026-07-19T15:35:26.315Z"),
    createdAt: new Date("2026-07-19T15:12:34.570Z"),
    updatedAt: new Date("2026-07-19T16:00:00.000Z"),
    format: "STANDARD",
    content: "<p>isi</p>",
    ...overrides,
  } as Article;
}

describe("buildArticleNewsArticleJsonLd", () => {
  it("uses ISO datePublished and falls back dateModified to publishedAt", () => {
    const json = buildArticleNewsArticleJsonLd(
      sampleArticle({ contentUpdatedAt: null }),
      "https://arasvara.id/entertainment/2026/07/19/judul-tes",
    );

    expect(json.datePublished).toBe("2026-07-19T15:35:26.315Z");
    expect(json.dateModified).toBe("2026-07-19T15:35:26.315Z");
    expect(json.dateModified).not.toBe("2026-07-19T16:00:00.000Z");
  });

  it("prefers contentUpdatedAt for dateModified", () => {
    const json = buildArticleNewsArticleJsonLd(
      sampleArticle({
        contentUpdatedAt: new Date("2026-07-20T01:00:00.000Z"),
      }),
      "https://arasvara.id/entertainment/2026/07/19/judul-tes",
    );

    expect(json.dateModified).toBe("2026-07-20T01:00:00.000Z");
  });

  it("includes articleBody, wordCount, keywords, and other recommended fields", () => {
    const json = buildArticleNewsArticleJsonLd(
      sampleArticle({
        content: "<p>Tes artikel dengan <strong>HTML tags</strong> dan multiple words.</p>",
        category: { _id: "cat1", name: "Nasional", slug: "nasional" } as Article["category"],
        tags: [
          { _id: "t1", name: "pemilu", slug: "pemilu" },
          { _id: "t2", name: "politik", slug: "politik" },
        ],
      }),
      "https://arasvara.id/nasional/2026/07/19/judul-tes",
    );

    expect(json.articleBody).toBe("Tes artikel dengan HTML tags dan multiple words.");
    expect(json.wordCount).toBe(8);
    expect(json.articleSection).toBe("Nasional");
    expect(json.inLanguage).toBe("id-ID");
    expect(json.isAccessibleForFree).toBe(true);
    expect(json.keywords).toEqual(["pemilu", "politik"]);
  });

  it("omits articleBody and wordCount when content is empty", () => {
    const json = buildArticleNewsArticleJsonLd(
      sampleArticle({ content: "" }),
      "https://arasvara.id/news/test",
    );

    expect(json.articleBody).toBeUndefined();
    expect(json.wordCount).toBeUndefined();
    expect(json.inLanguage).toBe("id-ID");
    expect(json.isAccessibleForFree).toBe(true);
  });

  it("omits keywords when tags array is empty", () => {
    const json = buildArticleNewsArticleJsonLd(
      sampleArticle({ tags: [] }),
      "https://arasvara.id/news/test",
    );

    expect(json.keywords).toBeUndefined();
  });
});
