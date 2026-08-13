import { beforeEach, describe, expect, it, vi } from "vitest";
import { Db, Document, ObjectId } from "mongodb";
import { encodeArticleCursor } from "@/lib/article-pagination";

vi.mock("@/lib/helper-article", () => ({
  FEATURED_IMAGE_LOOKUP_STAGES: [],
  mapDocToArticle: vi.fn(async (doc: Document) => ({
    ...doc,
    _id: doc._id?.toString(),
  })),
}));

import { getAllArticles } from "@/services/article/coreGetArticleService";

interface FakeDatabase {
  db: Db;
  aggregate: ReturnType<typeof vi.fn>;
  countDocuments: ReturnType<typeof vi.fn>;
  findCategory: ReturnType<typeof vi.fn>;
}

function createFakeDatabase(docs: Document[], total = docs.length): FakeDatabase {
  const aggregate = vi.fn(() => ({
    toArray: vi.fn(async () => docs),
  }));
  const countDocuments = vi.fn(async () => total);
  const findCategory = vi.fn(async () => null);

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "categories") {
        return { findOne: findCategory };
      }
      return { aggregate, countDocuments };
    }),
  } as unknown as Db;

  return { db, aggregate, countDocuments, findCategory };
}

describe("getAllArticles pagination", () => {
  const publishedAt = new Date("2026-08-10T09:15:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses limit + 1 and emits a compound cursor when more data exists", async () => {
    const docs = [
      { _id: new ObjectId("507f1f77bcf86cd799439013"), publishedAt },
      { _id: new ObjectId("507f1f77bcf86cd799439012"), publishedAt },
      { _id: new ObjectId("507f1f77bcf86cd799439011"), publishedAt },
    ];
    const fake = createFakeDatabase(docs, 10);

    const result = await getAllArticles(fake.db, {
      limit: 2,
      status: "PUBLISHED",
    });

    expect(result.articles).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeTruthy();

    const pipeline = fake.aggregate.mock.calls[0][0] as Document[];
    expect(pipeline).toContainEqual({
      $sort: { publishedAt: -1, _id: -1 },
    });
    expect(pipeline).toContainEqual({ $limit: 3 });
  });

  it("stops cleanly on the final page", async () => {
    const docs = [
      { _id: new ObjectId("507f1f77bcf86cd799439013"), publishedAt },
      { _id: new ObjectId("507f1f77bcf86cd799439012"), publishedAt },
    ];
    const fake = createFakeDatabase(docs, 2);

    const result = await getAllArticles(fake.db, {
      limit: 2,
      status: "PUBLISHED",
    });

    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("applies the same timestamp and id boundary from a cursor", async () => {
    const boundaryId = new ObjectId("507f1f77bcf86cd799439012");
    const cursor = encodeArticleCursor(publishedAt, boundaryId);
    const fake = createFakeDatabase([], 10);

    await getAllArticles(fake.db, {
      limit: 2,
      status: "PUBLISHED",
      cursor,
    });

    const pipeline = fake.aggregate.mock.calls[0][0] as Document[];
    expect(pipeline[0]).toEqual({
      $match: {
        $and: [
          {
            deletedAt: { $in: [null, ""] },
            status: "PUBLISHED",
          },
          {
            $or: [
              { publishedAt: { $lt: publishedAt } },
              {
                publishedAt,
                _id: { $lt: boundaryId },
              },
            ],
          },
        ],
      },
    });
  });

  it("counts category and exclusions in the base query, not the cursor query", async () => {
    const categoryId = new ObjectId("507f1f77bcf86cd799439020");
    const excludedId = new ObjectId("507f1f77bcf86cd799439021");
    const fake = createFakeDatabase([], 5);
    fake.findCategory.mockResolvedValue({ _id: categoryId });

    await getAllArticles(fake.db, {
      limit: 7,
      status: "PUBLISHED",
      categorySlug: "nasional",
      excludeIds: [excludedId.toHexString()],
      cursor: encodeArticleCursor(
        publishedAt,
        new ObjectId("507f1f77bcf86cd799439022"),
      ),
    });

    expect(fake.countDocuments).toHaveBeenCalledWith({
      deletedAt: { $in: [null, ""] },
      status: "PUBLISHED",
      categoryId,
      _id: { $nin: [excludedId] },
    });
  });
});
