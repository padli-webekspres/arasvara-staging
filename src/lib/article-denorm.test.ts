import { describe, expect, it } from "vitest";
import {
  buildAuthorDenormFields,
  buildCategoryDenormFields,
} from "@/lib/article-denorm";

describe("buildAuthorDenormFields", () => {
  it("maps user fields to denormalized author paths", () => {
    expect(
      buildAuthorDenormFields({
        name: "Gabriel Santoso",
        slug: "gabriel-santoso",
        role: "writer",
      }),
    ).toEqual({
      "author.name": "Gabriel Santoso",
      "author.slug": "gabriel-santoso",
      "author.role": "writer",
    });
  });

  it("returns null when author name is empty", () => {
    expect(buildAuthorDenormFields({ name: "   ", slug: "gabriel" })).toBeNull();
    expect(buildAuthorDenormFields(null)).toBeNull();
  });
});

describe("buildCategoryDenormFields", () => {
  it("maps category fields to denormalized category paths", () => {
    expect(
      buildCategoryDenormFields({
        name: "Politik",
        slug: "politik",
      }),
    ).toEqual({
      "category.name": "Politik",
      "category.slug": "politik",
    });
  });
});
