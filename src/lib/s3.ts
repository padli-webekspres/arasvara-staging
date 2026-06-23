import { S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import http from "node:http";
import https from "node:https";

/** Batas koneksi HTTP paralel ke R2/MinIO per instance Node (default 200). */
export function getS3MaxSockets(): number {
  const n = Number(process.env.S3_MAX_SOCKETS);
  return Number.isFinite(n) && n > 0 ? n : 200;
}

const socketPoolOptions = {
  keepAlive: true,
  maxSockets: getS3MaxSockets(),
};

export const s3Client = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || undefined,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 5_000,
    socketTimeout: 30_000,
    socketAcquisitionWarningTimeout: 30_000,
    httpAgent: new http.Agent(socketPoolOptions),
    httpsAgent: new https.Agent(socketPoolOptions),
  }),
});

export const S3_BUCKET = process.env.S3_BUCKET_NAME || "arasvara-images";
