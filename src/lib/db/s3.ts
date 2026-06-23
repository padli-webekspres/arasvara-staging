import { S3Client } from "@aws-sdk/client-s3";

// Cek apakah kita sedang di tahap Development (lokal) atau Production
const isDevelopment = process.env.NODE_ENV === "development";

export const s3Client = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "arasvara_admin",
    secretAccessKey: process.env.S3_SECRET_KEY || "arasvara_password123",
  },
  // Wajib true untuk MinIO lokal agar URL formatnya http://localhost:9000/bucket-name/...
  // Wajib false untuk Cloudflare R2 / AWS S3 Production
  forcePathStyle: isDevelopment,
});
