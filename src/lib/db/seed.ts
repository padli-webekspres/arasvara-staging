import { Db, MongoServerError, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import slugify from "slugify";
import { connectToDatabase } from "./db";
import { ROLES as ROLE_DEFINITIONS } from "@/lib/constants";

/** Koleksi yang dibuat kosong (jika belum ada). */
const SEEDED_COLLECTIONS = [
  "ads_article",
  "ads_homepage",
  "article_views",
  "articles",
  "audit_log",
  "carousel_section",
  "categories",
  "configuration",
  "media",
  "monthly_targets",
  "notifications",
  "push_tokens",
  "section_articles",
  "sponsors",
  "users",
  "video_section",
] as const;

async function ensureCollection(db: Db, name: string): Promise<void> {
  try {
    await db.createCollection(name);
  } catch (err: unknown) {
    if (err instanceof MongoServerError && err.code === 48) return;
    throw err;
  }
}

/** Dokumen kategori mengikuti pola insert di categoryService (MongoDB). */
function categoryDoc(input: {
  _id: ObjectId;
  name: string;
  slug: string;
  description: string;
  parentId: ObjectId | null;
  showOnNavbar: boolean;
  nickname?: string;
}) {
  const now = new Date();
  return {
    _id: input._id,
    name: input.name,
    slug: input.slug,
    description: input.description,
    parentId: input.parentId,
    showOnNavbar: input.showOnNavbar,
    ...(input.nickname ? { nickname: input.nickname } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

function buildArasvaraCategories(): Record<
  string,
  ReturnType<typeof categoryDoc>
> {
  const ids = {
    tekno: new ObjectId(),
    ekonomiBisnis: new ObjectId(),
    metro: new ObjectId(),
    lifestyle: new ObjectId(),
    news: new ObjectId(),
    entertainment: new ObjectId(),
    otomotif: new ObjectId(),
    aneka: new ObjectId(),
    anekaOpini: new ObjectId(),
    anekaTajuk: new ObjectId(),
    anekaLensa: new ObjectId(),
  };

  const bySlug = (name: string) =>
    slugify(name, { lower: true, strict: true, trim: true });

  const docs: Record<string, ReturnType<typeof categoryDoc>> = {
    tekno: categoryDoc({
      _id: ids.tekno,
      name: "Tekno",
      slug: "tekno",
      description: "Berita teknologi, gadget, dan inovasi digital.",
      parentId: null,
      showOnNavbar: true,
    }),
    ekonomiBisnis: categoryDoc({
      _id: ids.ekonomiBisnis,
      name: "Ekonomi Bisnis",
      slug: bySlug("Ekonomi Bisnis"),
      description: "Ekonomi, bisnis, pasar modal, dan industri.",
      parentId: null,
      showOnNavbar: true,
    }),
    metro: categoryDoc({
      _id: ids.metro,
      name: "Metro",
      slug: "metro",
      description: "Peristiwa perkotaan dan wilayah metropolitan.",
      parentId: null,
      showOnNavbar: true,
    }),
    lifestyle: categoryDoc({
      _id: ids.lifestyle,
      name: "Lifestyle",
      slug: "lifestyle",
      description: "Gaya hidup, wellness, dan tren.",
      parentId: null,
      showOnNavbar: true,
    }),
    news: categoryDoc({
      _id: ids.news,
      name: "News",
      slug: "news",
      description: "Berita umum dan perkembangan terkini.",
      parentId: null,
      showOnNavbar: true,
    }),
    entertainment: categoryDoc({
      _id: ids.entertainment,
      name: "Entertainment",
      slug: "entertainment",
      description: "Hiburan, selebriti, dan budaya pop.",
      parentId: null,
      showOnNavbar: true,
    }),
    otomotif: categoryDoc({
      _id: ids.otomotif,
      name: "Otomotif",
      slug: bySlug("Otomotif"),
      description: "Mobil, motor, industri otomotif, dan transportasi.",
      parentId: null,
      showOnNavbar: true,
    }),
    aneka: categoryDoc({
      _id: ids.aneka,
      name: "Aneka",
      slug: "aneka",
      description:
        "Kanal aneka: sub-kanal Opini, Tajuk Rencana & News Marketing, dan Lensa Foto.",
      parentId: null,
      showOnNavbar: true,
      nickname: "Sub kanal: Opini, Tajuk Rencana & News Marketing, Lensa Foto",
    }),
    anekaOpini: categoryDoc({
      _id: ids.anekaOpini,
      name: "Opini",
      slug: "opini",
      description: "Opini dan tulisan pengamat di bawah kanal Aneka.",
      parentId: ids.aneka,
      showOnNavbar: false,
    }),
    anekaTajuk: categoryDoc({
      _id: ids.anekaTajuk,
      name: "Tajuk Rencana dan News Marketing",
      slug: bySlug("Tajuk Rencana dan News Marketing"),
      description:
        "Tajuk rencana serta konten news marketing di bawah kanal Aneka.",
      parentId: ids.aneka,
      showOnNavbar: false,
    }),
    anekaLensa: categoryDoc({
      _id: ids.anekaLensa,
      name: "Lensa Foto",
      slug: bySlug("Lensa Foto"),
      description: "Galeri dan liputan foto di bawah kanal Aneka.",
      parentId: ids.aneka,
      showOnNavbar: false,
    }),
  };

  return docs;
}

export async function seedDatabase(): Promise<{
  message: string;
  collectionsEnsured: number;
  usersInserted: number;
  categoriesInserted: number;
}> {
  const db = await connectToDatabase();

  for (const name of SEEDED_COLLECTIONS) {
    await ensureCollection(db, name);
  }

  const usersCollection = db.collection("users");
  const categoriesCollection = db.collection("categories");

  const passwordHash = await bcrypt.hash("password123", 12);
  const nowIso = new Date().toISOString();

  let usersInserted = 0;
  const adminExists = await usersCollection.findOne({
    email: "admin@arasvara.id",
  });

  if (!adminExists) {
    const adminDoc = {
      _id: new ObjectId(),
      email: "admin@arasvara.id",
      password: passwordHash,
      name: "Super Admin",
      role: "admin",
      avatar: "https://i.pravatar.cc/150?u=admin",
      bio: "Akun super administrator (seed).",
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    };

    const nonAdminRoles = ROLE_DEFINITIONS.filter((r) => r.value !== "admin");

    const roleUsers = nonAdminRoles.map((def) => ({
      _id: new ObjectId(),
      email: `${def.value.replace(/\//g, "-")}@arasvara.id`,
      password: passwordHash,
      name: def.label,
      role: def.value,
      avatar: `https://i.pravatar.cc/150?u=${encodeURIComponent(def.value)}`,
      bio: `Akun seed untuk peran ${def.label}.`,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    }));

    const insertResult = await usersCollection.insertMany([
      adminDoc,
      ...roleUsers,
    ]);
    usersInserted = insertResult.insertedCount;
  }

  let categoriesInserted = 0;
  const hasTeknoCategory = await categoriesCollection.findOne({
    slug: "tekno",
  });

  if (!hasTeknoCategory) {
    const tree = buildArasvaraCategories();
    const insertResult = await categoriesCollection.insertMany(
      Object.values(tree),
    );
    categoriesInserted = insertResult.insertedCount;
  }

  const nothingInserted = usersInserted === 0 && categoriesInserted === 0;

  return {
    message: nothingInserted
      ? "Tidak ada data baru yang disisipkan (admin dan hierarki kategori Tekno/Aneka sudah ada). Koleksi tetap dicek/dibuat."
      : "Seeding selesai.",
    collectionsEnsured: SEEDED_COLLECTIONS.length,
    usersInserted,
    categoriesInserted,
  };
}

async function main() {
  try {
    const result = await seedDatabase();
    console.log(result.message);
    console.log(
      `Koleksi: ${result.collectionsEnsured}, users baru: ${result.usersInserted}, kategori baru: ${result.categoriesInserted}`,
    );
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
