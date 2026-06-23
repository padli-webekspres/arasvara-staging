import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db/db";

/**
 * GET /api/refactoring-articles/denormalization
 *
 * Endpoint one-time refactoring untuk men-denormalisasi data pada collection `articles`:
 * - author.name  — diambil dari collection `users` berdasarkan authorId
 * - author.role  — diambil dari collection `users` berdasarkan authorId
 * - author.slug  — diambil dari collection `users` berdasarkan authorId
 * - category.name — diambil dari collection `categories` berdasarkan categoryId
 * - category.slug — diambil dari collection `categories` berdasarkan categoryId (DITAMBAHKAN)
 *
 * Strategi:
 * 1. Fetch seluruh users & categories ke Map (lookup O(1))
 * 2. Stream seluruh artikel menggunakan cursor (hemat RAM)
 * 3. Hanya update field yang BERUBAH (skip jika sudah cocok)
 * 4. BulkWrite per 1.000 dokumen untuk mencegah payload terlalu besar
 */
export async function GET() {
  try {
    const articlesCollection = await getCollection("articles");
    const usersCollection = await getCollection("users");
    const categoriesCollection = await getCollection("categories");

    // ── 1. Buat lookup Map untuk users ──
    // Hanya ambil field yang dibutuhkan (_id, name, role, slug) untuk hemat memori
    const users = await usersCollection
      .find({}, { projection: { _id: 1, name: 1, role: 1, slug: 1 } })
      .toArray();

    const userMap = new Map<string, { name: string; role: string; slug: string }>();
    for (const user of users) {
      if (user._id) {
        userMap.set(user._id.toString(), {
          name: user.name || "",
          role: user.role || "writer",
          slug: user.slug ? String(user.slug) : "",
        });
      }
    }

    // ── 2. Buat lookup Map untuk categories ──
    // Menambahkan `slug` di samping `name` yang sudah ada sebelumnya
    const categories = await categoriesCollection
      .find({}, { projection: { _id: 1, name: 1, slug: 1 } })
      .toArray();

    const categoryMap = new Map<string, { name: string; slug: string }>();
    for (const category of categories) {
      if (category._id) {
        categoryMap.set(category._id.toString(), {
          name: category.name || "",
          slug: category.slug || "",
        });
      }
    }

    // ── 3. Stream seluruh artikel dan siapkan bulk operations ──
    // Hanya fetch field yang dibutuhkan untuk perbandingan agar hemat RAM
    const articlesCursor = articlesCollection.find(
      {},
      {
        projection: {
          _id: 1,
          authorId: 1,
          categoryId: 1,
          "author.name": 1,
          "author.role": 1,
          "author.slug": 1,
          "category.name": 1,
          "category.slug": 1,
        },
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bulkOps: any[] = [];
    let processedCount = 0;
    let modifiedCountTotal = 0;
    let skippedCount = 0;

    for await (const article of articlesCursor) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateFields: Record<string, any> = {};

      // ── Update author.name dan author.role jika berbeda ──
      if (article.authorId) {
        const authorIdStr = article.authorId.toString();
        const authorData = userMap.get(authorIdStr);

        if (authorData) {
          // Hanya set jika nilai saat ini belum sesuai (hindari write yang tidak perlu)
          if (article.author?.name !== authorData.name) {
            updateFields["author.name"] = authorData.name;
          }
          if (article.author?.role !== authorData.role) {
            updateFields["author.role"] = authorData.role;
          }
          if (authorData.slug && article.author?.slug !== authorData.slug) {
            updateFields["author.slug"] = authorData.slug;
          }
        }
      }

      // ── Update category.name dan category.slug jika berbeda ──
      if (article.categoryId) {
        const categoryIdStr = article.categoryId.toString();
        const categoryData = categoryMap.get(categoryIdStr);

        if (categoryData) {
          // Hanya set jika nilai saat ini belum sesuai
          if (article.category?.name !== categoryData.name) {
            updateFields["category.name"] = categoryData.name;
          }
          if (article.category?.slug !== categoryData.slug) {
            updateFields["category.slug"] = categoryData.slug;
          }
        }
      }

      processedCount++;

      // Skip artikel yang tidak memiliki perubahan
      if (Object.keys(updateFields).length === 0) {
        skippedCount++;
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: article._id },
          update: { $set: updateFields },
        },
      });

      // Eksekusi bulkWrite setiap 1.000 operasi untuk mencegah memory / payload overflow
      if (bulkOps.length >= 1000) {
        const result = await articlesCollection.bulkWrite(bulkOps, {
          ordered: false, // Lanjutkan meski ada 1 yang gagal, lebih cepat
        });
        modifiedCountTotal += result.modifiedCount;
        bulkOps.length = 0; // Kosongkan array untuk batch berikutnya
      }
    }

    // ── 4. Eksekusi sisa batch terakhir (< 1.000 item) ──
    if (bulkOps.length > 0) {
      const result = await articlesCollection.bulkWrite(bulkOps, {
        ordered: false,
      });
      modifiedCountTotal += result.modifiedCount;
    }

    return NextResponse.json({
      success: true,
      message: "Denormalisasi artikel selesai.",
      totalProcessed: processedCount,
      totalModified: modifiedCountTotal,
      totalSkipped: skippedCount,
      fields: ["author.name", "author.role", "author.slug", "category.name", "category.slug"],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Denormalization Refactoring Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Gagal menjalankan denormalisasi artikel",
        error: message,
      },
      { status: 500 },
    );
  }
}
