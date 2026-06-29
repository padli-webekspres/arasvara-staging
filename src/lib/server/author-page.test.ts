import { describe, expect, it } from "vitest";
import {
  buildAuthorCanonicalUrl,
  buildAuthorJsonLd,
  buildMetadataFromAuthor,
} from "@/lib/server/author-page";
import type { User } from "@/types/user";

const baseUser: User = {
  _id: "507f1f77bcf86cd799439011",
  email: "budi@example.com",
  name: "Budi Santoso",
  slug: "budi-santoso",
  role: "WRITER",
};

describe("buildMetadataFromAuthor", () => {
  it("sets indexable metadata when author has articles", () => {
    const metadata = buildMetadataFromAuthor(
      baseUser,
      { total: 5 },
      "budi-santoso",
    );

    expect(metadata.title).toBe("Budi Santoso | Arasvara");
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      buildAuthorCanonicalUrl("budi-santoso"),
    );
    expect(metadata.description).toContain("Budi Santoso");
    expect(metadata.description).toContain("5 artikel");
  });

  it("sets noindex when author has no articles", () => {
    const metadata = buildMetadataFromAuthor(
      baseUser,
      { total: 0 },
      "budi-santoso",
    );

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });
});

describe("buildAuthorJsonLd", () => {
  it("includes ProfilePage and article list", () => {
    const jsonLd = buildAuthorJsonLd(
      baseUser,
      [
        {
          slug: "artikel-satu",
          publicPath: "/business/2026/06/19/artikel-satu",
        } as never,
      ],
      buildAuthorCanonicalUrl("budi-santoso"),
    );

    expect(jsonLd["@type"]).toBe("ProfilePage");
    expect(jsonLd.mainEntity).toMatchObject({
      "@type": "Person",
      name: "Budi Santoso",
      url: buildAuthorCanonicalUrl("budi-santoso"),
    });
    expect(jsonLd.hasPart?.itemListElement).toHaveLength(1);
  });
});
