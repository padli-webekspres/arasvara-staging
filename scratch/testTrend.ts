import { connectToDatabase } from "../src/lib/db/db";
import { getTrafficTrend } from "../src/services/analytics/audienceAnalyticsService";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function runTest() {
  console.log("--- Menghubungkan ke Database ---");
  console.log("MONGO_URL:", process.env.MONGO_URL);
  console.log("DB_NAME:", process.env.DB_NAME);

  try {
    const db = await connectToDatabase();
    console.log("Database terkoneksi dengan sukses!");

    console.log("\n--- Menjalankan getTrafficTrend (Interval: Daily) ---");
    const dailyResults = await getTrafficTrend(db, {
      interval: "daily",
    });
    console.log(`Berhasil! Ditemukan ${dailyResults.length} data point.`);
    console.log("Sampel Data Point Pertama:", dailyResults[0]);
    console.log("Sampel Data Point Terakhir:", dailyResults[dailyResults.length - 1]);

    console.log("\n--- Menjalankan getTrafficTrend (Interval: Weekly) ---");
    const weeklyResults = await getTrafficTrend(db, {
      interval: "weekly",
    });
    console.log(`Berhasil! Ditemukan ${weeklyResults.length} data point.`);
    console.log("Sampel Data Point Pertama:", weeklyResults[0]);

    console.log("\n--- Menjalankan getTrafficTrend (Interval: Monthly) ---");
    const monthlyResults = await getTrafficTrend(db, {
      interval: "monthly",
    });
    console.log(`Berhasil! Ditemukan ${monthlyResults.length} data point.`);
    console.log("Sampel Data Point Pertama:", monthlyResults[0]);

    console.log("\nSemua verifikasi backend berhasil!");
    process.exit(0);
  } catch (error) {
    console.error("Terjadi error saat menjalankan test:", error);
    process.exit(1);
  }
}

runTest();
