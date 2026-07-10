import { describe, expect, it } from "vitest";
import {
  buildAuthorBioDisplay,
  buildAuthorCanonicalUrl,
  buildAuthorJsonLd,
  buildAuthorPageTitle,
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

describe("buildAuthorPageTitle", () => {
  it("uses Arasvara | Profil {nama} format", () => {
    expect(buildAuthorPageTitle("Gabriel Omar Batistuta")).toBe(
      "Arasvara | Profil Gabriel Omar Batistuta",
    );
  });
});

describe("buildAuthorBioDisplay", () => {
  it("returns bio when provided", () => {
    expect(buildAuthorBioDisplay("Jurnalis teknologi.", "Budi")).toBe(
      "Jurnalis teknologi.",
    );
  });

  it("returns neutral fallback when bio is empty", () => {
    expect(buildAuthorBioDisplay("", "Budi Santoso")).toContain(
      "Budi Santoso adalah bagian dari tim editorial Arasvara",
    );
  });

  it("returns fallback for placeholder values (-, null string)", () => {
    expect(buildAuthorBioDisplay("-", "Budi Santoso")).toContain(
      "Budi Santoso adalah bagian dari tim editorial Arasvara",
    );
    expect(buildAuthorBioDisplay("null", "Budi Santoso")).toContain(
      "Budi Santoso adalah bagian dari tim editorial Arasvara",
    );
    expect(buildAuthorBioDisplay(null, "Budi Santoso")).toContain(
      "Budi Santoso adalah bagian dari tim editorial Arasvara",
    );
  });
});

describe("buildMetadataFromAuthor", () => {
  it("sets indexable metadata when author has articles", () => {
    const metadata = buildMetadataFromAuthor(
      baseUser,
      { total: 5 },
      "budi-santoso",
    );

    expect(metadata.title).toEqual({
      absolute: "Arasvara | Profil Budi Santoso",
    });
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      buildAuthorCanonicalUrl("budi-santoso"),
    );
    expect(metadata.description).toContain("Budi Santoso");
    expect(metadata.description).toContain("5 artikel");
  });

  it("keeps indexable metadata when author has no articles", () => {
    const metadata = buildMetadataFromAuthor(
      baseUser,
      { total: 0 },
      "budi-santoso",
    );

    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.description).toContain("Budi Santoso");
  });

  it("uses bio for meta description when available", () => {
    const metadata = buildMetadataFromAuthor(
      { ...baseUser, bio: "Penulis politik dan ekonomi." },
      { total: 2 },
      "budi-santoso",
    );

    expect(metadata.description).toBe("Penulis politik dan ekonomi.");
  });
});

describe("buildAuthorJsonLd", () => {
  it("includes ProfilePage, description, and article list", () => {
    const jsonLd = buildAuthorJsonLd(
      { ...baseUser, bio: "Penulis berita." },
      [
        {
          slug: "artikel-satu",
          publicPath: "/business/2026/06/19/artikel-satu",
        } as never,
      ],
      buildAuthorCanonicalUrl("budi-santoso"),
    );

    expect(jsonLd["@type"]).toBe("ProfilePage");
    expect(jsonLd.description).toBe("Penulis berita.");
    expect(jsonLd.mainEntity).toMatchObject({
      "@type": "Person",
      name: "Budi Santoso",
      url: buildAuthorCanonicalUrl("budi-santoso"),
      description: "Penulis berita.",
    });
    expect(jsonLd.hasPart?.itemListElement).toHaveLength(1);
  });

  it("includes neutral fallback description when bio is empty", () => {
    const jsonLd = buildAuthorJsonLd(
      baseUser,
      [],
      buildAuthorCanonicalUrl("budi-santoso"),
    );

    expect(jsonLd.description).toContain(
      "Budi Santoso adalah bagian dari tim editorial Arasvara",
    );
    expect(jsonLd.mainEntity).toMatchObject({
      description: expect.stringContaining(
        "Budi Santoso adalah bagian dari tim editorial Arasvara",
      ),
    });
  });
});

describe("buildAuthorCanonicalUrl", () => {
  it("uses /penulis prefix", () => {
    expect(buildAuthorCanonicalUrl("budi-santoso")).toMatch(
      /\/penulis\/budi-santoso$/,
    );
  });
});
