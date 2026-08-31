import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import logger from "@/lib/logger";
import { getUserFromRequest } from "@/lib/auth";
import { getAllArticles } from "@/services/article/coreGetArticleService";
import { createArticle } from "@/services/article/coreWriteArticleService";
import { hasPermission } from "@/lib/auth-client";
import { ObjectId } from "mongodb";
import { mapArticleWriteError } from "@/lib/map-article-write-error";

const MAX_PAGE_SIZE = 50;
const MAX_EXCLUDED_IDS = 100;

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  max?: number,
): number {
  if (value == null) return fallback;
  if (!/^\d+$/.test(value)) {
    throw Object.assign(new Error("Parameter pagination tidak valid"), {
      status: 400,
    });
  }

  const parsed = Number(value);
  if (parsed < 1 || (max != null && parsed > max)) {
    throw Object.assign(new Error("Parameter pagination di luar batas"), {
      status: 400,
    });
  }
  return parsed;
}

export async function GET(req: NextRequest) {
  try {
    const db = await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const limit = parsePositiveInteger(
      searchParams.get("limit"),
      10,
      MAX_PAGE_SIZE,
    );
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const category = searchParams.get("category") || undefined;
    const status = searchParams.get("status") || undefined;
    const featured = searchParams.get("featured") === "true";
    const headline = searchParams.get("headline") === "true";
    const search = searchParams.get("search") || undefined;
    const cursor = searchParams.get("cursor") || undefined;
    const userId = searchParams.get("userId") || undefined;
    const formatRaw = searchParams.get("format") || undefined;
    const excludeIds = (searchParams.get("excludeIds") || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (cursor && searchParams.has("page")) {
      throw Object.assign(
        new Error("Gunakan cursor atau page, bukan keduanya"),
        { status: 400 },
      );
    }
    if (excludeIds.length > MAX_EXCLUDED_IDS) {
      throw Object.assign(
        new Error(`Maksimal ${MAX_EXCLUDED_IDS} artikel dapat dikecualikan`),
        { status: 400 },
      );
    }
    if (excludeIds.some((id) => !ObjectId.isValid(id))) {
      throw Object.assign(new Error("ID artikel pengecualian tidak valid"), {
        status: 400,
      });
    }
    const format =
      formatRaw === "GALLERY" || formatRaw === "STANDARD"
        ? formatRaw
        : undefined;

    const { articles, nextCursor, hasMore, total } = await getAllArticles(db, {
      limit,
      page,
      categorySlug: category,
      status,
      featured,
      headline,
      search,
      cursor,
      userId,
      format,
      excludeIds,
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      articles,
      nextCursor,
      hasMore,
      total,
      totalPages,
    });
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : 500;
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      logger.warn("Unauthorized attempt to create article");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = (user.role || "").toString().toLowerCase();
    if (!hasPermission(role, "create_article")) {
      logger.warn({ user }, "Forbidden: user not allowed to create article");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Artikel form sekarang selalu mengirim JSON (gambar sudah diupload via presigned URL)
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 400 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: any = {};

    {
      const body = await req.json();

      // Parse format field (default to STANDARD)
      const format = body.format === "GALLERY" ? "GALLERY" : "STANDARD";

      const title =
        typeof body.title === "string"
          ? body.title.trim()
          : String(body.title ?? "").trim();

      const rawCategoryId = body.categoryId;
      let categoryIdStr = "";
      if (typeof rawCategoryId === "string" && rawCategoryId.trim()) {
        categoryIdStr = rawCategoryId.trim();
      } else if (
        rawCategoryId &&
        typeof rawCategoryId === "object" &&
        typeof rawCategoryId.$oid === "string" &&
        rawCategoryId.$oid.trim()
      ) {
        categoryIdStr = rawCategoryId.$oid.trim();
      }

      // Validate required fields based on format
      if (!title || !categoryIdStr) {
        throw Object.assign(
          new Error("Missing required fields: title and categoryId"),
          {
            status: 400,
          },
        );
      }

      // Validate format-specific required fields
      if (format === "STANDARD" && !body.content) {
        throw Object.assign(
          new Error(
            "Missing required field: content is required for STANDARD format",
          ),
          { status: 400 },
        );
      }

      // Parse tags: can be string[] or comma-separated string
      let tags: string[] | undefined = undefined;
      if (Array.isArray(body.tags)) {
        tags = body.tags;
      } else if (typeof body.tags === "string") {
        tags = body.tags
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
      }

      // Parse contentMedia: expect array of objects
      let contentMedia: unknown[] | undefined = undefined;
      if (Array.isArray(body.contentMedia)) {
        contentMedia = body.contentMedia;
      }

      // Parse galleryItems: expect array of objects for GALLERY format
      let galleryItems: unknown[] | undefined = undefined;
      if (format === "GALLERY") {
        if (!Array.isArray(body.galleryItems) || body.galleryItems.length === 0) {
          throw Object.assign(
            new Error(`Invalid galleryItems: must be a non-empty array`),
            { status: 400 },
          );
        }
        galleryItems = body.galleryItems;
      }

      let contributorIdsFromBody: string[] | undefined;
      if (Array.isArray(body.contributorIds)) {
        const raw: unknown[] = body.contributorIds;
        const ids: string[] = raw
          .map((id: unknown) => String(id).trim())
          .filter((id): id is string => /^[a-f\d]{24}$/i.test(id));
        contributorIdsFromBody = [...new Set(ids)];
      }

      payload = {
        title,
        content: body.content,
        excerpt: body.excerpt,
        categoryId: categoryIdStr,
        tags,
        featuredImage: body.featuredImage ?? null,
        contentMedia,
        status: body.status,
        scheduledAt: body.scheduledAt,
        format,
        galleryItems,
        ...(typeof body.authorId === "string" &&
        /^[a-f\d]{24}$/i.test(body.authorId)
          ? { authorId: body.authorId }
          : {}),
        ...(body.editorId === null || body.editorId === ""
          ? { editorId: null }
          : typeof body.editorId === "string" &&
              /^[a-f\d]{24}$/i.test(body.editorId)
            ? { editorId: body.editorId }
            : {}),
        ...(contributorIdsFromBody !== undefined
          ? { contributorIds: contributorIdsFromBody }
          : {}),
        relatedArticles: body.relatedArticles,
        boostIndexing: body.boostIndexing === true,
      };
    }

    const db = await connectToDatabase();
    const article = await createArticle(db, payload, {
      _id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    logger.info(
      { userId: user._id, articleId: article._id, title: article.title },
      "Article created successfully",
    );
    return NextResponse.json({ article }, { status: 201 });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating article");
    const { status, body } = mapArticleWriteError(error);
    return NextResponse.json(body, { status });
  }
}
