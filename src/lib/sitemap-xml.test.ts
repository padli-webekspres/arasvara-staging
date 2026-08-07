import { describe, expect, it } from "vitest";
import {
  buildNewsSitemapXml,
  buildSitemapXml,
  isRecentNewsArticle,
} from "@/lib/sitemap-xml";

describe("buildSitemapXml structured paths", () => {
  it("includes structured article loc without /news prefix", () => {
    const xml = buildSitemapXml(
      "https://arasvara.id",
      [
        {
          slug: "judul-baru",
          title: "Judul Baru",
          publicPath: "/business/2026/06/19/judul-baru",
          publishedAt: "2026-06-19T10:00:00.000Z",
          updatedAt: "2026-06-19T12:00:00.000Z",
        },
      ],
      [],
    );

    expect(xml).toContain(
      "<loc>https://arasvara.id/business/2026/06/19/judul-baru</loc>",
    );
    expect(xml).not.toContain("/news/business/2026/06/19/judul-baru");
  });

  it("skips legacy and stale /news structured paths", () => {
    const xml = buildSitemapXml(
      "https://arasvara.id",
      [
        {
          slug: "legacy",
          title: "Legacy",
          publicPath: "/news/legacy-slug",
          publishedAt: "2026-06-19T10:00:00.000Z",
          updatedAt: "2026-06-19T12:00:00.000Z",
        },
        {
          slug: "stale",
          title: "Stale",
          publicPath: "/news/business/2026/06/19/stale",
          publishedAt: "2026-06-19T10:00:00.000Z",
          updatedAt: "2026-06-19T12:00:00.000Z",
        },
      ],
      [],
    );

    expect(xml).not.toContain("/news/legacy-slug");
    expect(xml).not.toContain("/news/business/2026/06/19/stale");
  });

  it("includes penulis profile URLs", () => {
    const xml = buildSitemapXml(
      "https://arasvara.id",
      [],
      [],
      [
        {
          slug: "budi-santoso",
          name: "Budi Santoso",
          updatedAt: "2026-06-19T12:00:00.000Z",
        },
      ],
    );

    expect(xml).toContain(
      "<loc>https://arasvara.id/penulis/budi-santoso</loc>",
    );
    expect(xml).not.toContain("/author/");
    expect(xml).toContain("<lastmod>2026-06-19T12:00:00.000Z</lastmod>");
  });

  it("includes category URLs with new format /:slug without /category/ prefix", () => {
    const xml = buildSitemapXml(
      "https://arasvara.id",
      [],
      [{ name: "Bisnis", slug: "bisnis" }],
    );

    expect(xml).toContain("<loc>https://arasvara.id/bisnis</loc>");
    expect(xml).not.toContain("/category/bisnis");
  });

  it("does not embed news:news blocks in the regular sitemap anymore", () => {
    const xml = buildSitemapXml(
      "https://arasvara.id",
      [
        {
          slug: "judul-baru",
          title: "Judul Baru",
          publicPath: "/bisnis/2026/08/03/judul-baru",
          publishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      [],
    );

    expect(xml).not.toContain("<news:news>");
    expect(xml).not.toContain("xmlns:news");
  });
});

describe("buildNewsSitemapXml", () => {
  it("renders news:news metadata for recent articles", () => {
    const xml = buildNewsSitemapXml("https://arasvara.id", [
      {
        slug: "judul-baru",
        title: "Judul Baru",
        publicPath: "/bisnis/2026/08/03/judul-baru",
        publishedAt: "2026-08-03T10:00:00.000Z",
        updatedAt: "2026-08-03T12:00:00.000Z",
      },
    ]);

    expect(xml).toContain(
      "<loc>https://arasvara.id/bisnis/2026/08/03/judul-baru</loc>",
    );
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"');
    expect(xml).toContain("<news:name>Arasvara</news:name>");
    expect(xml).toContain("<news:language>id</news:language>");
    expect(xml).toContain(
      "<news:publication_date>2026-08-03T10:00:00.000Z</news:publication_date>",
    );
    expect(xml).toContain("<news:title>Judul Baru</news:title>");
  });

  it("skips articles without a valid structured publicPath", () => {
    const xml = buildNewsSitemapXml("https://arasvara.id", [
      {
        slug: "legacy",
        title: "Legacy",
        publicPath: "/news/legacy-slug",
        publishedAt: "2026-08-03T10:00:00.000Z",
        updatedAt: "2026-08-03T12:00:00.000Z",
      },
    ]);

    expect(xml).not.toContain("/news/legacy-slug");
    expect(xml).not.toContain("<url>");
  });

  it("escapes special characters in titles", () => {
    const xml = buildNewsSitemapXml("https://arasvara.id", [
      {
        slug: "judul",
        title: "Berita & <breaking> \"resmi\"",
        publicPath: "/bisnis/2026/08/03/judul",
        publishedAt: "2026-08-03T10:00:00.000Z",
        updatedAt: "2026-08-03T12:00:00.000Z",
      },
    ]);

    expect(xml).toContain(
      "<news:title>Berita &amp; &lt;breaking&gt; &quot;resmi&quot;</news:title>",
    );
  });
});

describe("isRecentNewsArticle", () => {
  it("returns true for articles within the window and false for older ones", () => {
    const now = Date.now();
    expect(isRecentNewsArticle(new Date(now).toISOString())).toBe(true);
    expect(
      isRecentNewsArticle(new Date(now - 50 * 60 * 60 * 1000).toISOString()),
    ).toBe(false);
    expect(isRecentNewsArticle("invalid-date")).toBe(false);
  });
});
