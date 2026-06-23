import { describe, expect, it } from "vitest";
import {
  buildArticlePublicPath,
  buildLegacyArticlePath,
  buildStructuredArticlePath,
  parseNewsArticlePath,
  pathsEqual,
  publishedAtToWibDateParts,
  resolveUrlFormatForNewArticle,
  resolveArticleHref,
  resolvePublicArticleHref,
  resolveCmsArticleViewHref,
} from "@/lib/article-public-path";
import { ArticleStatus } from "@/types/article";

describe("resolveArticleHref", () => {
  it("prefers publicPath over slug", () => {
    expect(
      resolveArticleHref({
        slug: "judul",
        publicPath: "/news/nasional/2026/06/19/judul",
      }),
    ).toBe("/news/nasional/2026/06/19/judul");
  });

  it("falls back to legacy slug path", () => {
    expect(resolveArticleHref({ slug: "judul-lama" })).toBe("/news/judul-lama");
  });
});

describe("resolvePublicArticleHref", () => {
  it("returns publicPath when available", () => {
    expect(
      resolvePublicArticleHref({
        slug: "judul",
        publicPath: "/news/nasional/2026/06/19/judul",
      }),
    ).toBe("/news/nasional/2026/06/19/judul");
  });

  it("returns # when publicPath missing and no compute inputs", () => {
    expect(resolvePublicArticleHref({ slug: "judul-lama" })).toBe("#");
  });

  it("computes structured path when publicPath missing", () => {
    expect(
      resolvePublicArticleHref({
        slug: "judul-lama",
        category: { slug: "nasional" },
        publishedAt: new Date("2026-06-18T17:00:00.000Z"),
      }),
    ).toBe("/news/nasional/2026/06/19/judul-lama");
  });

  it("returns # when publicPath is legacy format without compute inputs", () => {
    expect(
      resolvePublicArticleHref({
        slug: "judul-lama",
        publicPath: "/news/judul-lama",
      }),
    ).toBe("#");
  });

  it("computes structured path when publicPath is legacy format", () => {
    expect(
      resolvePublicArticleHref({
        slug: "judul-lama",
        publicPath: "/news/judul-lama",
        categorySlug: "nasional",
        publishedAt: new Date("2026-06-18T17:00:00.000Z"),
      }),
    ).toBe("/news/nasional/2026/06/19/judul-lama");
  });
});

describe("resolveCmsArticleViewHref", () => {
  it("uses publicPath for PUBLISHED", () => {
    expect(
      resolveCmsArticleViewHref({
        status: ArticleStatus.PUBLISHED,
        slug: "judul",
        publicPath: "/news/nasional/2026/06/19/judul",
      }),
    ).toBe("/news/nasional/2026/06/19/judul");
  });

  it("computes structured path for PUBLISHED without publicPath", () => {
    expect(
      resolveCmsArticleViewHref({
        status: ArticleStatus.PUBLISHED,
        slug: "judul-lama",
        categorySlug: "nasional",
        publishedAt: new Date("2026-06-18T17:00:00.000Z"),
      }),
    ).toBe("/news/nasional/2026/06/19/judul-lama");
  });

  it("ignores legacy publicPath and computes structured for PUBLISHED", () => {
    expect(
      resolveCmsArticleViewHref({
        status: ArticleStatus.PUBLISHED,
        slug: "judul-lama",
        publicPath: "/news/judul-lama",
        categorySlug: "nasional",
        publishedAt: new Date("2026-06-18T17:00:00.000Z"),
      }),
    ).toBe("/news/nasional/2026/06/19/judul-lama");
  });

  it("returns # for PUBLISHED without structured path inputs", () => {
    expect(
      resolveCmsArticleViewHref({
        status: ArticleStatus.PUBLISHED,
        slug: "judul-lama",
      }),
    ).toBe("#");
  });

  it("uses slug preview for DRAFT", () => {
    expect(
      resolveCmsArticleViewHref({
        status: ArticleStatus.DRAFT,
        slug: "draft-judul",
        publicPath: "/news/nasional/2026/06/19/draft-judul",
      }),
    ).toBe("/news/draft-judul");
  });

  it("uses slug preview for TAKEN_DOWN", () => {
    expect(
      resolveCmsArticleViewHref({
        status: ArticleStatus.TAKEN_DOWN,
        slug: "taken-down",
        publicPath: "/news/nasional/2026/06/19/taken-down",
      }),
    ).toBe("/news/taken-down");
  });
});

describe("publishedAtToWibDateParts", () => {
  it("maps UTC evening to next WIB calendar day", () => {
    const parts = publishedAtToWibDateParts(new Date("2026-06-18T17:00:00.000Z"));
    expect(parts).toEqual({ year: 2026, month: 6, day: 19 });
  });

  it("handles midnight WIB boundary (still previous day)", () => {
    const parts = publishedAtToWibDateParts(new Date("2026-06-19T16:59:59.999Z"));
    expect(parts).toEqual({ year: 2026, month: 6, day: 19 });
  });

  it("flips to next WIB day at 17:00 UTC", () => {
    const parts = publishedAtToWibDateParts(new Date("2026-06-19T17:00:00.000Z"));
    expect(parts).toEqual({ year: 2026, month: 6, day: 20 });
  });

  it("zero-pads month in structured path output", () => {
    const path = buildStructuredArticlePath({
      categorySlug: "nasional",
      publishedAt: new Date("2026-01-05T12:00:00.000Z"),
      articleSlug: "judul",
    });
    expect(path).toBe("/news/nasional/2026/01/05/judul");
  });
});

describe("buildLegacyArticlePath", () => {
  it("builds /news/{slug}", () => {
    expect(buildLegacyArticlePath("pemilu-2024")).toBe("/news/pemilu-2024");
  });
});

describe("buildArticlePublicPath", () => {
  it("returns null for draft", () => {
    expect(
      buildArticlePublicPath({
        slug: "judul",
        publishedAt: null,
        categorySlug: "nasional",
        urlFormat: "structured",
        status: ArticleStatus.DRAFT,
      }),
    ).toBeNull();
  });

  it("returns legacy path for published legacy article", () => {
    expect(
      buildArticlePublicPath({
        slug: "pemilu-2024",
        publishedAt: new Date("2026-06-18T17:00:00.000Z"),
        categorySlug: "nasional",
        urlFormat: "legacy",
        status: ArticleStatus.PUBLISHED,
      }),
    ).toBe("/news/pemilu-2024");
  });

  it("returns structured WIB path for published structured article", () => {
    expect(
      buildArticlePublicPath({
        slug: "pemilu-2024",
        publishedAt: new Date("2026-06-18T17:00:00.000Z"),
        categorySlug: "nasional",
        urlFormat: "structured",
        status: ArticleStatus.PUBLISHED,
      }),
    ).toBe("/news/nasional/2026/06/19/pemilu-2024");
  });

  it("throws when structured published article has no category slug", () => {
    expect(() =>
      buildArticlePublicPath({
        slug: "judul",
        publishedAt: new Date("2026-06-18T17:00:00.000Z"),
        categorySlug: null,
        urlFormat: "structured",
        status: ArticleStatus.PUBLISHED,
      }),
    ).toThrow(/categorySlug wajib/);
  });
});

describe("parseNewsArticlePath", () => {
  it("parses legacy single segment", () => {
    expect(parseNewsArticlePath(["pemilu-2024"])).toEqual({
      kind: "legacy",
      slug: "pemilu-2024",
    });
  });

  it("parses structured five segments", () => {
    expect(
      parseNewsArticlePath(["nasional", "2026", "06", "19", "pemilu-2024"]),
    ).toEqual({
      kind: "structured",
      publicPath: "/news/nasional/2026/06/19/pemilu-2024",
    });
  });

  it("returns null for invalid segment count", () => {
    expect(parseNewsArticlePath(["a", "b"])).toBeNull();
  });
});

describe("pathsEqual", () => {
  it("treats encoded paths as equal", () => {
    expect(pathsEqual("/news/judul%20baru", "/news/judul baru")).toBe(true);
  });

  it("ignores trailing slash", () => {
    expect(pathsEqual("/news/slug/", "/news/slug")).toBe(true);
  });
});

describe("resolveUrlFormatForNewArticle", () => {
  it("defaults to structured when env unset", () => {
    const prev = process.env.ARTICLE_STRUCTURED_URL_ENABLED;
    delete process.env.ARTICLE_STRUCTURED_URL_ENABLED;
    expect(resolveUrlFormatForNewArticle()).toBe("structured");
    if (prev === undefined) {
      delete process.env.ARTICLE_STRUCTURED_URL_ENABLED;
    } else {
      process.env.ARTICLE_STRUCTURED_URL_ENABLED = prev;
    }
  });
});
