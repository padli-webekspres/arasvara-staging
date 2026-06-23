import { MongoClient, Db } from "mongodb";

let client: MongoClient | null;
let db: Db | null;

export async function connectToDatabase(): Promise<Db> {
  if (db) return db;

  if (!process.env.MONGO_URL) {
    throw new Error(
      "Please define the MONGO_URL environment variable inside .env",
    );
  }

  if (!client) {
    try {
      client = new MongoClient(process.env.MONGO_URL);
      await client.connect();
    } catch (error) {
      client = null;
      throw error;
    }
  }

  db = client.db(process.env.DB_NAME || "arasvara_news");
  return db;
}

/**
 * Kembalikan instance MongoClient yang aktif.
 * Digunakan untuk membuat session/transaction.
 */
export async function getMongoClient(): Promise<MongoClient> {
  await connectToDatabase();
  if (!client) throw new Error("MongoClient belum tersedia");
  return client;
}

export async function getCollection(collectionName: string) {
  const database = await connectToDatabase();
  return database.collection(collectionName);
}
