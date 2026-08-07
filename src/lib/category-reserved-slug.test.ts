import { describe, it, expect } from "vitest";
import { isReservedRootSegment, RESERVED_ROOT_SEGMENTS } from "@/lib/article-public-path";

describe("Category Reserved Root Segment Check", () => {
  it("harus mengenali slug terproteksi seperti search, indeks, news, category, dll.", () => {
    expect(isReservedRootSegment("search")).toBe(true);
    expect(isReservedRootSegment("SEARCH")).toBe(true);
    expect(isReservedRootSegment("indeks")).toBe(true);
    expect(isReservedRootSegment("category")).toBe(true);
    expect(isReservedRootSegment("admin-xyz")).toBe(true);
    expect(isReservedRootSegment("api")).toBe(true);
  });

  it("harus mengizinkan slug kategori normal yang bukan reserved root segment", () => {
    expect(isReservedRootSegment("ekonomi")).toBe(false);
    expect(isReservedRootSegment("politik")).toBe(false);
    expect(isReservedRootSegment("teknologi")).toBe(false);
    expect(isReservedRootSegment("olahraga")).toBe(false);
  });

  it("harus memastikan RESERVED_ROOT_SEGMENTS mencakup semua rute publik statis utama", () => {
    const requiredSegments = ["category", "search", "indeks", "login", "admin-xyz", "api", "about-us"];
    for (const segment of requiredSegments) {
      expect(RESERVED_ROOT_SEGMENTS.has(segment)).toBe(true);
    }
  });
});
