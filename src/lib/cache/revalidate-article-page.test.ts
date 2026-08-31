import { describe, expect, it } from "vitest";
import {
  authorPathsFromSlugs,
  extractSlugFromPublicPath,
  listingContextFromArticleDoc,
  listingContextFromArticleDocs,
  listingPathsFromContext,
} from "@/lib/cache/revalidate-article-page";
import { getArticleRevalidateSeconds } from "@/lib/cache/article-cache-config";

describe("listingContextFromArticleDoc", () => {
  it("reads nested denorm slugs", () => {
    expect(
      listingContextFromArticleDoc({
        category: { slug: "lifestyle", name: "Lifestyle" },
        author: { slug: "andi-pratama", name: "Andi" },
      }),
    ).toEqual({
      categorySlug: "lifestyle",
      authorSlug: "andi-pratama",
    });
  });

  it("reads dotted denorm slugs", () => {
    expect(
      listingContextFromArticleDoc({
        "category.slug": "tekno",
        "author.slug": "sinta",
      }),
    ).toEqual({
      categorySlug: "tekno",
      authorSlug: "sinta",
    });
  });
});

describe("listingContextFromArticleDocs", () => {
  it("keeps previous slugs when category or author changes", () => {
    expect(
      listingContextFromArticleDocs(
        {
          category: { slug: "news" },
          author: { slug: "baru" },
        },
        {
          category: { slug: "lifestyle" },
          author: { slug: "lama" },
        },
      ),
    ).toEqual({
      categorySlug: "news",
      previousCategorySlug: "lifestyle",
      authorSlug: "baru",
      previousAuthorSlug: "lama",
    });
  });
});

describe("listingPathsFromContext", () => {
  it("always includes home and indeks", () => {
    expect(listingPathsFromContext()).toEqual(["/", "/indeks"]);
  });

  it("adds category and author paths, skips reserved root segments", () => {
    expect(
      listingPathsFromContext({
        categorySlug: "lifestyle",
        previousCategorySlug: "search",
        authorSlug: "andi-pratama",
      }),
    ).toEqual(["/", "/indeks", "/lifestyle", "/penulis/andi-pratama"]);
  });

  it("dedupes identical current and previous slugs", () => {
    const paths = listingPathsFromContext({
      categorySlug: "tekno",
      previousCategorySlug: "tekno",
      authorSlug: "andi",
      previousAuthorSlug: "andi",
    });
    expect(paths.filter((p) => p === "/tekno")).toHaveLength(1);
    expect(paths.filter((p) => p === "/penulis/andi")).toHaveLength(1);
  });
});

describe("authorPathsFromSlugs", () => {
  it("builds /penulis paths for current and previous slugs", () => {
    expect(authorPathsFromSlugs("baru", "lama")).toEqual([
      "/penulis/baru",
      "/penulis/lama",
    ]);
  });

  it("dedupes identical slugs and skips empty", () => {
    expect(authorPathsFromSlugs("andi", "andi")).toEqual(["/penulis/andi"]);
    expect(authorPathsFromSlugs("andi", "  ")).toEqual(["/penulis/andi"]);
    expect(authorPathsFromSlugs("", null)).toEqual([]);
  });
});

describe("extractSlugFromPublicPath", () => {
  it("takes the last segment", () => {
    expect(
      extractSlugFromPublicPath("/lifestyle/2026/08/26/judul-artikel"),
    ).toBe("judul-artikel");
    expect(extractSlugFromPublicPath("/news/judul-lama")).toBe("judul-lama");
  });
});

describe("getArticleRevalidateSeconds", () => {
  it("defaults to 300 when env is unset", () => {
    const prev = process.env.ARTICLE_PAGE_REVALIDATE_SECONDS;
    delete process.env.ARTICLE_PAGE_REVALIDATE_SECONDS;
    expect(getArticleRevalidateSeconds()).toBe(300);
    if (prev !== undefined) process.env.ARTICLE_PAGE_REVALIDATE_SECONDS = prev;
  });
});
