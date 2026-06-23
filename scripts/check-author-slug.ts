import { MongoClient } from "mongodb";
import { bootstrapEnv } from "./bootstrap-env";
import { buildActiveUserFilter, isUserPubliclyVisible } from "../src/lib/user-validation";

async function main() {
  bootstrapEnv();

  const slug = process.argv[2] || "gabriel-omar-batistuta";

  const client = new MongoClient(process.env.MONGO_URL!);
  await client.connect();
  const db = client.db(process.env.DB_NAME || "arasvara_news");

  const direct = await db.collection("users").findOne({ slug });
  const active = await db.collection("users").findOne({
    slug,
    ...buildActiveUserFilter(),
  });

  console.log(
    JSON.stringify(
      {
        slug,
        direct: direct
          ? {
              id: direct._id.toString(),
              slug: direct.slug,
              deletedAt: direct.deletedAt ?? null,
              isActive: direct.isActive ?? null,
              visible: isUserPubliclyVisible(direct as Record<string, unknown>),
            }
          : null,
        active: active ? { id: active._id.toString(), slug: active.slug } : null,
      },
      null,
      2,
    ),
  );

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
