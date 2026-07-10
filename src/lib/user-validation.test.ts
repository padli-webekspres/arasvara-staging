import { describe, expect, it } from "vitest";
import {
  generateUserSlug,
  normalizeUserName,
  nameNormalizedForStorage,
} from "@/lib/user-validation";
import { buildAuthorPublicPath, encodeAuthorSlugSegment, resolveAuthorPublicHref } from "@/lib/author-public-path";

describe("normalizeUserName", () => {
  it("menyamakan casing dan whitespace", () => {
    expect(normalizeUserName("  Andi Pratama  ")).toBe("andi pratama");
    expect(normalizeUserName("ANDI PRATAMA")).toBe("andi pratama");
  });

  it("menghapus tanda baca", () => {
    expect(normalizeUserName("Andi Pratama, S.Kom.")).toBe("andi pratama skom");
  });
});

describe("nameNormalizedForStorage", () => {
  it("mengembalikan null untuk nama kosong", () => {
    expect(nameNormalizedForStorage("   ")).toBeNull();
  });

  it("mengembalikan string dinormalisasi", () => {
    expect(nameNormalizedForStorage("Andi Pratama")).toBe("andi pratama");
  });
});

describe("generateUserSlug", () => {
  it("menghasilkan slug lowercase dengan strip", () => {
    expect(generateUserSlug("Andi Pratama")).toBe("andi-pratama");
  });

  it("menangani karakter khusus", () => {
    expect(generateUserSlug("Redaksi & Tim")).toBe("redaksi-and-tim");
  });
});

describe("author-public-path", () => {
  it("buildAuthorPublicPath", () => {
    expect(buildAuthorPublicPath("andi-pratama")).toBe("/penulis/andi-pratama");
  });

  it("encodeAuthorSlugSegment", () => {
    expect(encodeAuthorSlugSegment("andi pratama")).toBe("andi%20pratama");
  });

  it("resolveAuthorPublicHref returns null for ineligible role", () => {
    expect(
      resolveAuthorPublicHref({ slug: "andi-pratama", role: "admin" }),
    ).toBeNull();
    expect(
      resolveAuthorPublicHref({ slug: "andi-pratama", role: "reporter" }),
    ).toBeNull();
  });

  it("resolveAuthorPublicHref returns path for writer/editor with slug", () => {
    expect(
      resolveAuthorPublicHref({ slug: "andi-pratama", role: "writer" }),
    ).toBe("/penulis/andi-pratama");
    expect(
      resolveAuthorPublicHref({ slug: "andi-pratama", role: "editor" }),
    ).toBe("/penulis/andi-pratama");
  });
});
