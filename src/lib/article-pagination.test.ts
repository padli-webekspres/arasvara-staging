import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import {
  buildArticleCursorQuery,
  decodeArticleCursor,
  encodeArticleCursor,
  InvalidArticleCursorError,
} from "@/lib/article-pagination";

describe("article pagination cursor", () => {
  const publishedAt = new Date("2026-08-10T09:15:00.000Z");
  const articleId = new ObjectId("507f1f77bcf86cd799439011");

  it("round-trips an opaque compound cursor", () => {
    const cursor = encodeArticleCursor(publishedAt, articleId);
    const decoded = decodeArticleCursor(cursor);

    expect(cursor).not.toContain(publishedAt.toISOString());
    expect(decoded.publishedAt).toEqual(publishedAt);
    expect(decoded.articleId?.equals(articleId)).toBe(true);
    expect(decoded.legacy).toBe(false);
  });

  it("builds a stable query for duplicate publication timestamps", () => {
    const query = buildArticleCursorQuery(
      decodeArticleCursor(encodeArticleCursor(publishedAt, articleId)),
    );

    expect(query).toEqual({
      $or: [
        { publishedAt: { $lt: publishedAt } },
        {
          publishedAt,
          _id: { $lt: articleId },
        },
      ],
    });
  });

  it("accepts legacy ISO cursors during migration", () => {
    const decoded = decodeArticleCursor(publishedAt.toISOString());

    expect(decoded.legacy).toBe(true);
    expect(decoded.articleId).toBeNull();
    expect(buildArticleCursorQuery(decoded)).toEqual({
      publishedAt: { $lt: publishedAt },
    });
  });

  it.each(["", "not-a-cursor", "eyJ2IjoyfQ", "%%%%"])(
    "rejects invalid cursor %j",
    (cursor) => {
      expect(() => decodeArticleCursor(cursor)).toThrow(
        InvalidArticleCursorError,
      );
    },
  );

  it("rejects invalid values when encoding", () => {
    expect(() =>
      encodeArticleCursor(new Date("invalid"), articleId),
    ).toThrow(InvalidArticleCursorError);
    expect(() => encodeArticleCursor(publishedAt, "invalid-id")).toThrow(
      InvalidArticleCursorError,
    );
  });
});
