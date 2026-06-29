import { describe, expect, it } from "vitest";
import { buildSitemapXml } from "@/lib/sitemap-xml";

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

  it("includes author profile URLs", () => {
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
      "<loc>https://arasvara.id/author/budi-santoso</loc>",
    );
    expect(xml).toContain("<lastmod>2026-06-19T12:00:00.000Z</lastmod>");
  });
});
