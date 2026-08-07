import { describe, expect, it } from "vitest";
import { ArticleStatus } from "@/types/article";
import { shouldCountArticleView } from "@/lib/articleViewAccess";

describe("shouldCountArticleView", () => {
  it("allows only published articles", () => {
    expect(shouldCountArticleView(ArticleStatus.PUBLISHED)).toBe(true);
    expect(shouldCountArticleView(" published ")).toBe(true);
  });

  it("skips preview and unknown statuses", () => {
    expect(shouldCountArticleView(ArticleStatus.PENDING_REVIEW)).toBe(false);
    expect(shouldCountArticleView(ArticleStatus.DRAFT)).toBe(false);
    expect(shouldCountArticleView(ArticleStatus.SCHEDULED)).toBe(false);
    expect(shouldCountArticleView(undefined)).toBe(false);
  });
});
