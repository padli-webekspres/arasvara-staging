import { describe, expect, it } from "vitest";
import {
  buildArticlePublicPath,
  buildLegacyArticlePath,
  buildStructuredArticlePath,
  isReservedRootSegment,
  isStructuredPublicPath,
  parseLegacyNewsSegments,
  parseNewsArticlePath,
  parseStructuredArticleSegments,
  pathsEqual,
  publishedAtToWibDateParts,
  resolveUrlFormatForNewArticle,
  resolveArticleHref,
  resolvePublicArticleHref,
  resolveCmsArticleViewHref,
  isValidArticlePublicPath,
} from "@/lib/article-public-path";
import { ArticleStatus } from "@/types/article";

describe("resolveArticleHref", () => {
  it("prefers publicPath over slug", () => {
    expect(
      resolveArticleHref({
        slug: "judul",
        publicPath: "/nasional/2026/06/19/judul",
      }),
    ).toBe("/nasional/2026/06/19/judul");
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
        publicPath: "/nasional/2026/06/19/judul",
      }),
    ).toBe("/nasional/2026/06/19/judul");
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
    ).toBe("/nasional/2026/06/19/judul-lama");
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
    ).toBe("/nasional/2026/06/19/judul-lama");
  });
});

describe("resolveCmsArticleViewHref", () => {
  it("uses publicPath for PUBLISHED", () => {
    expect(
      resolveCmsArticleViewHref({
        status: ArticleStatus.PUBLISHED,
        slug: "judul",
        publicPath: "/nasional/2026/06/19/judul",
      }),
    ).toBe("/nasional/2026/06/19/judul");
  });

  it("computes structured path for PUBLISHED without publicPath", () => {
    expect(
      resolveCmsArticleViewHref({
        status: ArticleStatus.PUBLISHED,
        slug: "judul-lama",
        categorySlug: "nasional",
        publishedAt: new Date("2026-06-18T17:00:00.000Z"),
      }),
    ).toBe("/nasional/2026/06/19/judul-lama");
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
    ).toBe("/nasional/2026/06/19/judul-lama");
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
        publicPath: "/nasional/2026/06/19/draft-judul",
      }),
    ).toBe("/news/draft-judul");
  });

  it("uses slug preview for TAKEN_DOWN", () => {
    expect(
      resolveCmsArticleViewHref({
        status: ArticleStatus.TAKEN_DOWN,
        slug: "taken-down",
        publicPath: "/nasional/2026/06/19/taken-down",
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
    expect(path).toBe("/nasional/2026/01/05/judul");
  });
});

describe("buildLegacyArticlePath", () => {
  it("builds /news/{slug}", () => {
    expect(buildLegacyArticlePath("pemilu-2024")).toBe("/news/pemilu-2024");
  });
});

describe("buildStructuredArticlePath", () => {
  it("builds root path without /news prefix", () => {
    expect(
      buildStructuredArticlePath({
        categorySlug: "business",
        publishedAt: new Date("2026-06-18T17:00:00.000Z"),
        articleSlug: "pemilu-2024",
      }),
    ).toBe("/business/2026/06/19/pemilu-2024");
  });

  it("builds structured path for category news", () => {
    expect(
      buildStructuredArticlePath({
        categorySlug: "news",
        publishedAt: new Date("2026-06-18T17:00:00.000Z"),
        articleSlug: "judul",
      }),
    ).toBe("/news/2026/06/19/judul");
  });

  it("throws for reserved category slug", () => {
    expect(() =>
      buildStructuredArticlePath({
        categorySlug: "search",
        publishedAt: new Date("2026-06-18T17:00:00.000Z"),
        articleSlug: "judul",
      }),
    ).toThrow(/reserved/);
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
    ).toBe("/nasional/2026/06/19/pemilu-2024");
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

describe("parseLegacyNewsSegments", () => {
  it("parses legacy single segment", () => {
    expect(parseLegacyNewsSegments(["pemilu-2024"])).toEqual({
      kind: "legacy",
      slug: "pemilu-2024",
    });
  });

  it("returns null for multi-segment paths", () => {
    expect(parseLegacyNewsSegments(["nasional", "2026", "06", "19", "slug"])).toBeNull();
  });
});

describe("parseStructuredArticleSegments", () => {
  it("parses structured five segments", () => {
    expect(
      parseStructuredArticleSegments(["nasional", "2026", "06", "19", "pemilu-2024"]),
    ).toEqual({
      kind: "structured",
      publicPath: "/nasional/2026/06/19/pemilu-2024",
    });
  });

  it("parses structured five segments for category news", () => {
    expect(
      parseStructuredArticleSegments(["news", "2026", "06", "19", "pemilu-2024"]),
    ).toEqual({
      kind: "structured",
      publicPath: "/news/2026/06/19/pemilu-2024",
    });
  });

  it("returns null for reserved category", () => {
    expect(
      parseStructuredArticleSegments(["search", "2026", "06", "19", "pemilu-2024"]),
    ).toBeNull();
  });

  it("returns null for invalid segment count", () => {
    expect(parseStructuredArticleSegments(["a", "b"])).toBeNull();
  });

  it("returns null for invalid date segments", () => {
    expect(
      parseStructuredArticleSegments(["nasional", "20xx", "06", "19", "slug"]),
    ).toBeNull();
  });
});

describe("parseNewsArticlePath (deprecated)", () => {
  it("delegates to parseLegacyNewsSegments", () => {
    expect(parseNewsArticlePath(["pemilu-2024"])).toEqual({
      kind: "legacy",
      slug: "pemilu-2024",
    });
  });

  it("does not parse structured segments", () => {
    expect(
      parseNewsArticlePath(["nasional", "2026", "06", "19", "pemilu-2024"]),
    ).toBeNull();
  });
});

describe("isStructuredPublicPath", () => {
  it("accepts root structured path", () => {
    expect(isStructuredPublicPath("/nasional/2026/06/19/judul")).toBe(true);
  });

  it("accepts structured path for category news", () => {
    expect(isStructuredPublicPath("/news/2026/06/19/judul")).toBe(true);
  });

  it("rejects old double-prefix structured path", () => {
    expect(isStructuredPublicPath("/news/nasional/2026/06/19/judul")).toBe(false);
  });

  it("rejects legacy single-segment path", () => {
    expect(isStructuredPublicPath("/news/judul-lama")).toBe(false);
  });
});

describe("isReservedRootSegment", () => {
  it("flags reserved segments case-insensitively", () => {
    expect(isReservedRootSegment("Search")).toBe(true);
    expect(isReservedRootSegment("business")).toBe(false);
    expect(isReservedRootSegment("news")).toBe(false);
  });
});

describe("isValidArticlePublicPath", () => {
  it("accepts legacy and structured paths", () => {
    expect(isValidArticlePublicPath("/news/legacy-slug")).toBe(true);
    expect(isValidArticlePublicPath("/business/2026/06/19/slug")).toBe(true);
    expect(isValidArticlePublicPath("/news/2026/06/19/slug")).toBe(true);
  });

  it("rejects invalid paths", () => {
    expect(isValidArticlePublicPath("/news/cat/2026/06/19/slug")).toBe(false);
    expect(isValidArticlePublicPath("/search/2026/06/19/slug")).toBe(false);
  });
});

describe("pathsEqual", () => {
  it("treats encoded paths as equal", () => {
    expect(pathsEqual("/news/judul%20baru", "/news/judul baru")).toBe(true);
  });

  it("ignores trailing slash", () => {
    expect(pathsEqual("/nasional/2026/06/19/slug/", "/nasional/2026/06/19/slug")).toBe(
      true,
    );
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
