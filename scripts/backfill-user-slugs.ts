/**
 * Backfill nameNormalized + slug untuk user aktif.
 *
 * Default: dry-run
 * Lokal: npm run backfill:user-slugs -- --execute
 * Prod:  npm run backfill:user-slugs:prod -- --execute
 * Index: tambahkan --create-index (hanya dengan --execute)
 */
import { MongoClient, ObjectId, type Collection } from "mongodb";
import { bootstrapEnv, scriptArgsWithoutEnvFile } from "./bootstrap-env";
import {
  buildActiveUserFilter,
  generateUserSlug,
  nameNormalizedForStorage,
  normalizeUserName,
} from "../src/lib/user-validation";

const loadedEnvFile = bootstrapEnv();

const args = new Set(scriptArgsWithoutEnvFile());
const isExecute = args.has("--execute") && !args.has("--dry-run");
const createIndex = args.has("--create-index");

const SLUG_SUFFIX_PATTERN = /-(\d+)$/;

type UserDoc = {
  _id: ObjectId;
  name: string;
  slug?: string | null;
  nameNormalized?: string | null;
  createdAt?: Date | string;
};

function allocateSlug(baseSlug: string, usedSlugs: Set<string>): string {
  if (!usedSlugs.has(baseSlug)) return baseSlug;

  const baseWithoutSuffix = baseSlug.replace(SLUG_SUFFIX_PATTERN, "");
  let suffix = 2;
  while (suffix < 1000) {
    const candidate = `${baseWithoutSuffix}-${suffix}`;
    if (!usedSlugs.has(candidate)) return candidate;
    suffix += 1;
  }

  throw new Error(`Gagal mengalokasikan slug unik untuk basis "${baseSlug}"`);
}

function identityNeedsUpdate(
  doc: UserDoc,
  nameNormalized: string,
  slug: string,
): boolean {
  const currentNormalized = doc.nameNormalized
    ? String(doc.nameNormalized).trim()
    : "";
  const currentSlug = doc.slug ? String(doc.slug).trim() : "";
  return currentNormalized !== nameNormalized || currentSlug !== slug;
}

async function createUserIdentityIndexes(
  collection: Collection,
): Promise<void> {
  const indexes = await collection.indexes();

  const nameIndex = "users_nameNormalized_unique_active";
  if (!indexes.some((idx) => idx.name === nameIndex)) {
    await collection.createIndex(
      { nameNormalized: 1 },
      {
        unique: true,
        name: nameIndex,
        partialFilterExpression: {
          deletedAt: { $in: [null, ""] },
          nameNormalized: { $type: "string" },
        },
      },
    );
    console.log(`Index dibuat: ${nameIndex}`);
  } else {
    console.log(`Index sudah ada: ${nameIndex}`);
  }

  const slugIndex = "users_slug_unique_active";
  if (!indexes.some((idx) => idx.name === slugIndex)) {
    await collection.createIndex(
      { slug: 1 },
      {
        unique: true,
        name: slugIndex,
        partialFilterExpression: {
          deletedAt: { $in: [null, ""] },
          slug: { $type: "string" },
        },
      },
    );
    console.log(`Index dibuat: ${slugIndex}`);
  } else {
    console.log(`Index sudah ada: ${slugIndex}`);
  }
}

async function main() {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "arasvara_news";

  if (!mongoUrl) {
    console.error("MONGO_URL tidak ditemukan di .env");
    process.exit(1);
  }

  console.log("=== Backfill nameNormalized & slug user ===");
  console.log(`Env file : ${loadedEnvFile}`);
  console.log(`Database : ${dbName}`);
  console.log(`Mode: ${isExecute ? "EXECUTE" : "DRY-RUN"}`);
  console.log(`Create index: ${createIndex ? "yes" : "no"}\n`);

  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection("users");

  try {
    const docs = (await collection
      .find(buildActiveUserFilter())
      .project({ name: 1, slug: 1, nameNormalized: 1, createdAt: 1 })
      .sort({ createdAt: 1, _id: 1 })
      .toArray()) as UserDoc[];

    const nameGroups = new Map<string, UserDoc[]>();
    for (const doc of docs) {
      const normalized = normalizeUserName(String(doc.name ?? ""));
      if (!normalized) continue;
      const list = nameGroups.get(normalized) ?? [];
      list.push(doc);
      nameGroups.set(normalized, list);
    }

    const duplicateNames = [...nameGroups.entries()].filter(
      ([, group]) => group.length > 1,
    );

    if (duplicateNames.length > 0) {
      console.error(
        `Ditemukan ${duplicateNames.length} grup nama duplikat (normalized).`,
      );
      console.error(
        "Selesaikan manual dulu (rename di CMS/DB), lalu jalankan audit:user-slugs.",
      );
      for (const [normalized, group] of duplicateNames.slice(0, 10)) {
        console.error(`\n  [${normalized}]`);
        for (const doc of group) {
          console.error(
            `    - ${doc._id.toString()} | ${String(doc.name)}`,
          );
        }
      }
      if (duplicateNames.length > 10) {
        console.error(`\n  ... dan ${duplicateNames.length - 10} grup lainnya`);
      }
      process.exit(1);
    }

    const usedSlugs = new Set<string>();

    let toUpdate = 0;
    let skipped = 0;
    let invalidName = 0;
    const bulkOps: Array<{
      updateOne: {
        filter: { _id: ObjectId };
        update: { $set: { nameNormalized: string; slug: string } };
      };
    }> = [];

    for (const doc of docs) {
      const displayName = String(doc.name ?? "").trim();
      const nameNormalized = nameNormalizedForStorage(displayName);

      if (!nameNormalized) {
        invalidName += 1;
        console.warn(
          `Lewati user ${doc._id.toString()}: nama kosong/tidak valid`,
        );
        continue;
      }

      const baseSlug = generateUserSlug(displayName);
      if (!baseSlug) {
        invalidName += 1;
        console.warn(
          `Lewati user ${doc._id.toString()}: slug tidak bisa dibuat dari nama`,
        );
        continue;
      }

      const slug = allocateSlug(baseSlug, usedSlugs);

      if (!identityNeedsUpdate(doc, nameNormalized, slug)) {
        skipped += 1;
        usedSlugs.add(slug);
        continue;
      }

      toUpdate += 1;
      usedSlugs.add(slug);

      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { nameNormalized, slug } },
        },
      });
    }

    console.log(`Total user aktif: ${docs.length}`);
    console.log(`Akan di-update: ${toUpdate}`);
    console.log(`Sudah valid (skip): ${skipped}`);
    console.log(`Nama tidak valid: ${invalidName}`);

    if (toUpdate > 0 && toUpdate <= 20) {
      console.log("\n--- Sample update ---");
      for (const op of bulkOps.slice(0, 20)) {
        const id = op.updateOne.filter._id.toString();
        const doc = docs.find((d) => d._id.toString() === id);
        console.log(
          `  ${id} | ${doc?.name ?? "?"} → slug=${op.updateOne.update.$set.slug}`,
        );
      }
    }

    if (isExecute && bulkOps.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < bulkOps.length; i += batchSize) {
        const batch = bulkOps.slice(i, i + batchSize);
        await collection.bulkWrite(batch, { ordered: false });
      }
      console.log(`\nBulk write selesai: ${bulkOps.length} dokumen.`);
    }

    if (createIndex) {
      if (!isExecute) {
        console.error("\n--create-index memerlukan --execute");
        process.exit(1);
      }
      console.log("\n--- Membuat index unique ---");
      await createUserIdentityIndexes(collection);
    } else if (isExecute) {
      console.log(
        "\nTip: jalankan ulang dengan --create-index untuk pasang index unique.",
      );
    }

    if (!isExecute && toUpdate > 0) {
      console.log("\nDry-run selesai. Tambahkan --execute untuk menulis ke DB.");
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
