import { getCollection } from "@/lib/db/db";

export interface RecommendedTag {
  name: string;
  slug: string;
  count: number;
}

const RECOMMENDATION_COLLECTION = "tag_recommendations";
const ARTICLE_COLLECTION = "articles";

/**
 * Mengambil daftar rekomendasi tag terpopuler dari cache database.
 * Jika cache kosong (cold start), otomatis memicu perhitungan ulang terlebih dahulu.
 * 
 * @param limit Jumlah maksimal tag yang ingin diambil
 */
export async function getRecommendedTags(limit = 10): Promise<RecommendedTag[]> {
  const col = await getCollection(RECOMMENDATION_COLLECTION);
  
  const cachedTags = await col
    .find()
    .sort({ count: -1 })
    .limit(limit)
    .toArray();

  if (cachedTags.length === 0) {
    // Cold start: hitung rekomendasi sekarang juga jika cache kosong
    const freshTags = await updateRecommendedTags();
    return freshTags.slice(0, limit);
  }

  return cachedTags.map((doc) => ({
    name: doc.name as string,
    slug: doc.slug as string,
    count: doc.count as number,
  }));
}

/**
 * Melakukan kalkulasi ulang rekomendasi tag terpopuler dari seluruh artikel.
 * Menggunakan MongoDB Aggregation Pipeline untuk memproses data secara efisien di sisi database.
 * Hasilnya akan disimpan kembali ke koleksi cache tag_recommendations.
 */
export async function updateRecommendedTags(): Promise<RecommendedTag[]> {
  const articlesCol = await getCollection(ARTICLE_COLLECTION);
  const recommendationCol = await getCollection(RECOMMENDATION_COLLECTION);

  // Jalankan MongoDB Aggregation Pipeline
  const pipeline = [
    // 1. Filter hanya artikel yang sudah PUBLISHED dan belum dihapus (deletedAt: null / tidak ada)
    {
      $match: {
        status: "PUBLISHED",
        deletedAt: null,
      },
    },
    // 2. Pecah array tags menjadi baris dokumen tersendiri
    {
      $unwind: "$tags",
    },
    // 3. Kelompokkan berdasarkan slug dan name tag untuk menghitung frekuensi pemakaian
    {
      $group: {
        _id: {
          slug: "$tags.slug",
          name: "$tags.name",
        },
        count: { $sum: 1 },
      },
    },
    // 4. Urutkan berdasarkan count dari yang tertinggi ke terendah
    {
      $sort: { count: -1 },
    },
    // 5. Batasi cache hanya menyimpan 10 tag terpopuler saja
    {
      $limit: 10,
    },
  ];

  const aggregatedResults = await articlesCol.aggregate(pipeline).toArray();

  // Format hasil agregasi agar sesuai interface RecommendedTag
  const formattedTags: RecommendedTag[] = aggregatedResults.map((item) => ({
    name: item._id.name as string,
    slug: item._id.slug as string,
    count: item.count as number,
  }));

  // Simpan hasil ke cache tag_recommendations
  // Untuk menghindari downtime saat pergantian data cache, kita hapus dulu lalu insert baru
  await recommendationCol.deleteMany({});
  
  if (formattedTags.length > 0) {
    await recommendationCol.insertMany(formattedTags);
  }

  return formattedTags;
}
