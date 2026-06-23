import { createHash, randomBytes } from "crypto";
import { ObjectId } from "mongodb";
import { getCollection, connectToDatabase } from "@/lib/db/db";
import { REFRESH_TOKEN_MAX_AGE } from "@/lib/auth-config";

const COLLECTION = "refresh_tokens";

export interface RefreshTokenDocument {
  tokenHash: string;
  userId: ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

let indexesEnsured = false;

async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const db = await connectToDatabase();
  const col = db.collection(COLLECTION);
  await col.createIndex({ tokenHash: 1 }, { unique: true });
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await col.createIndex({ userId: 1 });
  indexesEnsured = true;
}

export async function createRefreshToken(
  userId: string,
): Promise<{ raw: string; expiresAt: Date }> {
  await ensureIndexes();
  const raw = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000);

  const col = await getCollection(COLLECTION);
  await col.insertOne({
    tokenHash,
    userId: new ObjectId(userId),
    expiresAt,
    createdAt: new Date(),
  });

  return { raw, expiresAt };
}

export async function validateAndRotateRefreshToken(
  raw: string,
): Promise<{ userId: string; newRefreshRaw: string } | null> {
  if (!raw?.trim()) return null;
  await ensureIndexes();

  const tokenHash = hashToken(raw);
  const col = await getCollection(COLLECTION);
  const doc = await col.findOne({ tokenHash });

  if (!doc) return null;
  if (doc.expiresAt < new Date()) {
    await col.deleteOne({ tokenHash });
    return null;
  }

  const userId = doc.userId.toString();

  await col.deleteOne({ tokenHash });

  const { raw: newRefreshRaw } = await createRefreshToken(userId);
  return { userId, newRefreshRaw };
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  if (!raw?.trim()) return;
  const col = await getCollection(COLLECTION);
  await col.deleteOne({ tokenHash: hashToken(raw) });
}

export async function revokeAllRefreshTokensForUser(
  userId: string,
): Promise<void> {
  const col = await getCollection(COLLECTION);
  await col.deleteMany({ userId: new ObjectId(userId) });
}
