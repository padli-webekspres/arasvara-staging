import { afterEach, describe, expect, it } from "vitest";
import {
  isArticleContentPaginationEnabled,
  nextArticlePageQuery,
  resolveArticleContentView,
} from "@/lib/article-content-pagination";

const ENV_KEY = "ARTICLE_CONTENT_PAGINATION";

describe("isArticleContentPaginationEnabled", () => {
  const previous = process.env[ENV_KEY];

  afterEach(() => {
    if (previous === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = previous;
    }
  });

  it("is false when unset", () => {
    delete process.env[ENV_KEY];
    expect(isArticleContentPaginationEnabled()).toBe(false);
  });

  it.each(["false", "FALSE", "0", "yes", "1", " ", ""])(
    "is false for %j",
    (value) => {
      expect(isArticleContentPaginationEnabled(value)).toBe(false);
    },
  );

  it.each(["true", "TRUE", " True "])("is true for %j", (value) => {
    expect(isArticleContentPaginationEnabled(value)).toBe(true);
  });
});

describe("resolveArticleContentView", () => {
  it.each([
    { pageParam: null, enabled: true, isShowAll: false, pageNum: 1 },
    { pageParam: null, enabled: false, isShowAll: true, pageNum: 1 },
    { pageParam: "all", enabled: true, isShowAll: true, pageNum: 1 },
    { pageParam: "all", enabled: false, isShowAll: true, pageNum: 1 },
    { pageParam: "2", enabled: true, isShowAll: false, pageNum: 2 },
    { pageParam: "2", enabled: false, isShowAll: false, pageNum: 2 },
    { pageParam: "1", enabled: false, isShowAll: false, pageNum: 1 },
    { pageParam: "foo", enabled: true, isShowAll: false, pageNum: 1 },
    { pageParam: "foo", enabled: false, isShowAll: true, pageNum: 1 },
    { pageParam: "", enabled: false, isShowAll: true, pageNum: 1 },
    { pageParam: "0", enabled: false, isShowAll: true, pageNum: 1 },
  ] as const)(
    "page=$pageParam enabled=$enabled → showAll=$isShowAll page=$pageNum",
    ({ pageParam, enabled, isShowAll, pageNum }) => {
      expect(resolveArticleContentView(pageParam, enabled)).toEqual({
        isShowAll,
        pageNum,
      });
    },
  );
});

describe("nextArticlePageQuery", () => {
  it("deletes page when going to 1 with pagination on", () => {
    expect(
      nextArticlePageQuery(new URLSearchParams("page=2"), 1, true),
    ).toBe("");
  });

  it("keeps page=1 when pagination is off", () => {
    expect(
      nextArticlePageQuery(new URLSearchParams("page=2"), 1, false),
    ).toBe("page=1");
  });

  it("sets page=all when pagination is on", () => {
    expect(
      nextArticlePageQuery(new URLSearchParams("ref=push"), "all", true),
    ).toBe("ref=push&page=all");
  });

  it("deletes page on show-all when pagination is off", () => {
    expect(
      nextArticlePageQuery(new URLSearchParams("page=2&ref=push"), "all", false),
    ).toBe("ref=push");
  });

  it("sets numeric page for both flag states", () => {
    expect(nextArticlePageQuery(new URLSearchParams(), 2, true)).toBe("page=2");
    expect(nextArticlePageQuery(new URLSearchParams(), 2, false)).toBe(
      "page=2",
    );
  });
});
