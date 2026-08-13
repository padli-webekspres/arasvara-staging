import { Document, ObjectId } from "mongodb";

const CURSOR_VERSION = 1;

interface EncodedArticleCursor {
  v: typeof CURSOR_VERSION;
  p: string;
  i: string;
}

export interface DecodedArticleCursor {
  publishedAt: Date;
  articleId: ObjectId | null;
  legacy: boolean;
}

export class InvalidArticleCursorError extends Error {
  readonly status = 400;

  constructor() {
    super("Cursor artikel tidak valid");
    this.name = "InvalidArticleCursorError";
  }
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function encodeArticleCursor(
  publishedAt: Date,
  articleId: ObjectId | string,
): string {
  const id = articleId instanceof ObjectId ? articleId.toHexString() : articleId;
  if (!ObjectId.isValid(id) || Number.isNaN(publishedAt.getTime())) {
    throw new InvalidArticleCursorError();
  }

  const payload: EncodedArticleCursor = {
    v: CURSOR_VERSION,
    p: publishedAt.toISOString(),
    i: id,
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeArticleCursor(cursor: string): DecodedArticleCursor {
  const legacyDate = parseDate(cursor);
  if (legacyDate) {
    return {
      publishedAt: legacyDate,
      articleId: null,
      legacy: true,
    };
  }

  try {
    const payload = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as Partial<EncodedArticleCursor>;
    const publishedAt = parseDate(payload.p);

    if (
      payload.v !== CURSOR_VERSION ||
      !publishedAt ||
      typeof payload.i !== "string" ||
      !ObjectId.isValid(payload.i)
    ) {
      throw new InvalidArticleCursorError();
    }

    return {
      publishedAt,
      articleId: new ObjectId(payload.i),
      legacy: false,
    };
  } catch (error) {
    if (error instanceof InvalidArticleCursorError) throw error;
    throw new InvalidArticleCursorError();
  }
}

export function buildArticleCursorQuery(
  decodedCursor: DecodedArticleCursor,
): Document {
  if (!decodedCursor.articleId) {
    return { publishedAt: { $lt: decodedCursor.publishedAt } };
  }

  return {
    $or: [
      { publishedAt: { $lt: decodedCursor.publishedAt } },
      {
        publishedAt: decodedCursor.publishedAt,
        _id: { $lt: decodedCursor.articleId },
      },
    ],
  };
}
