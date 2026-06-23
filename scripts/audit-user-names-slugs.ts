/**
 * Audit nama & slug user — deteksi duplikat normalized, slug bentrok, field hilang.
 *
 * Default: read-only
 * Lokal: npm run audit:user-slugs
 * Prod:  npm run audit:user-slugs:prod
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { MongoClient, ObjectId } from "mongodb";
import { bootstrapEnv } from "./bootstrap-env";
import {
  buildActiveUserFilter,
  generateUserSlug,
  normalizeUserName,
} from "../src/lib/user-validation";

const loadedEnvFile = bootstrapEnv();

type UserRow = {
  _id: string;
  name: string;
  email: string;
  role: string;
  slug: string | null;
  nameNormalized: string | null;
  computedNormalized: string;
  computedSlug: string;
};

function slugifyCollisions(
  users: Array<{ _id: string; name: string }>,
): Array<{ slug: string; users: Array<{ _id: string; name: string }> }> {
  const bySlug = new Map<string, Array<{ _id: string; name: string }>>();

  for (const user of users) {
    const slug = generateUserSlug(user.name);
    if (!slug) continue;
    const list = bySlug.get(slug) ?? [];
    list.push(user);
    bySlug.set(slug, list);
  }

  const collisions: Array<{
    slug: string;
    users: Array<{ _id: string; name: string }>;
  }> = [];

  for (const [slug, group] of bySlug) {
    const uniqueNames = new Set(group.map((u) => normalizeUserName(u.name)));
    if (group.length > 1 && uniqueNames.size > 1) {
      collisions.push({ slug, users: group });
    }
  }

  return collisions;
}

function toCsvRow(values: string[]): string {
  return values
    .map((v) => {
      const escaped = v.replace(/"/g, '""');
      return `"${escaped}"`;
    })
    .join(",");
}

async function main() {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "arasvara_news";

  if (!mongoUrl) {
    console.error("MONGO_URL tidak ditemukan di .env");
    process.exit(1);
  }

  console.log("=== Audit nama & slug user ===");
  console.log(`Env file : ${loadedEnvFile}`);
  console.log(`Database : ${dbName}`);
  console.log("Mode: AUDIT (read-only)\n");

  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db(dbName);

  try {
    const activeFilter = buildActiveUserFilter();
    const docs = await db
      .collection("users")
      .find(activeFilter)
      .project({
        name: 1,
        email: 1,
        role: 1,
        slug: 1,
        nameNormalized: 1,
        createdAt: 1,
      })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();

    const users: UserRow[] = docs.map((doc) => {
      const name = String(doc.name ?? "");
      const storedNormalized =
        doc.nameNormalized != null && String(doc.nameNormalized).trim() !== ""
          ? String(doc.nameNormalized)
          : null;
      const computedNormalized = normalizeUserName(name);
      return {
        _id: (doc._id as ObjectId).toHexString(),
        name,
        email: String(doc.email ?? ""),
        role: String(doc.role ?? ""),
        slug:
          doc.slug != null && String(doc.slug).trim() !== ""
            ? String(doc.slug)
            : null,
        nameNormalized: storedNormalized,
        computedNormalized,
        computedSlug: generateUserSlug(name),
      };
    });

    const nameGroups = new Map<string, UserRow[]>();
    for (const user of users) {
      if (!user.computedNormalized) continue;
      const list = nameGroups.get(user.computedNormalized) ?? [];
      list.push(user);
      nameGroups.set(user.computedNormalized, list);
    }

    const duplicateNames = [...nameGroups.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([normalized, group]) => ({
        nameNormalized: normalized,
        count: group.length,
        users: group.map((u) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          slug: u.slug,
        })),
      }));

    const slugGroups = new Map<string, UserRow[]>();
    for (const user of users) {
      if (!user.slug) continue;
      const list = slugGroups.get(user.slug) ?? [];
      list.push(user);
      slugGroups.set(user.slug, list);
    }

    const duplicateSlugs = [...slugGroups.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([slug, group]) => ({
        slug,
        count: group.length,
        users: group.map((u) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
        })),
      }));

    const slugifyCollisionGroups = slugifyCollisions(
      users.map((u) => ({ _id: u._id, name: u.name })),
    );

    const missingIdentity = users.filter(
      (u) => !u.slug || !u.nameNormalized,
    );

    const emptyNames = users.filter((u) => !u.computedNormalized);

    const staleNormalized = users.filter(
      (u) =>
        u.nameNormalized &&
        u.computedNormalized &&
        u.nameNormalized !== u.computedNormalized,
    );

    const staleSlug = users.filter(
      (u) =>
        u.slug &&
        u.computedSlug &&
        u.slug !== u.computedSlug &&
        !duplicateNames.some((g) =>
          g.users.some((x) => x._id === u._id),
        ),
    );

    const report = {
      generatedAt: new Date().toISOString(),
      database: dbName,
      summary: {
        totalActive: users.length,
        duplicateNameGroups: duplicateNames.length,
        duplicateSlugGroups: duplicateSlugs.length,
        slugifyCollisionGroups: slugifyCollisionGroups.length,
        missingSlugOrNormalized: missingIdentity.length,
        emptyNames: emptyNames.length,
        staleNameNormalized: staleNormalized.length,
        staleSlug: staleSlug.length,
        readyForBackfill:
          duplicateNames.length === 0 &&
          duplicateSlugs.length === 0 &&
          emptyNames.length === 0,
      },
      duplicateNames,
      duplicateSlugs,
      slugifyCollisions: slugifyCollisionGroups,
      missingIdentity: missingIdentity.slice(0, 100),
      emptyNames,
      staleNormalized: staleNormalized.slice(0, 50),
      staleSlug: staleSlug.slice(0, 50),
    };

    const outDir = join(process.cwd(), "scripts", "output");
    mkdirSync(outDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonPath = join(outDir, `user-slug-audit-${timestamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");

    if (duplicateNames.length > 0) {
      const csvLines = [
        toCsvRow([
          "nameNormalized",
          "_id",
          "name",
          "email",
          "role",
          "slug",
        ]),
      ];
      for (const group of duplicateNames) {
        for (const user of group.users) {
          csvLines.push(
            toCsvRow([
              group.nameNormalized,
              user._id,
              user.name,
              user.email,
              user.role,
              user.slug ?? "",
            ]),
          );
        }
      }
      const csvPath = join(outDir, `user-name-conflicts-${timestamp}.csv`);
      writeFileSync(csvPath, csvLines.join("\n"), "utf-8");
      console.log(`CSV konflik nama: ${csvPath}`);
    }

    console.log("--- Ringkasan ---");
    console.log(`User aktif:                    ${report.summary.totalActive}`);
    console.log(
      `Grup nama duplikat (normalized): ${report.summary.duplicateNameGroups}`,
    );
    console.log(`Grup slug duplikat di DB:      ${report.summary.duplicateSlugGroups}`);
    console.log(
      `Bentrok slugify (nama beda):   ${report.summary.slugifyCollisionGroups}`,
    );
    console.log(
      `Belum punya slug/normalized:   ${report.summary.missingSlugOrNormalized}`,
    );
    console.log(`Nama kosong setelah normalisasi: ${report.summary.emptyNames}`);
    console.log(`nameNormalized stale:          ${report.summary.staleNameNormalized}`);
    console.log(`slug tidak match computed:     ${report.summary.staleSlug}`);
    console.log(
      `\nSiap backfill: ${report.summary.readyForBackfill ? "YA" : "TIDAK — selesaikan konflik dulu"}`,
    );
    console.log(`\nLaporan JSON: ${jsonPath}`);

    if (!report.summary.readyForBackfill) {
      process.exitCode = 1;
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
