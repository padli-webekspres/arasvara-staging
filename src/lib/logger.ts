import pino from "pino";

// Deteksi environment (Railway biasanya otomatis set NODE_ENV=production)
const isProduction = process.env.NODE_ENV === "production";

const logger = pino({
  // Level log dinamis, default ke 'info'
  level: process.env.LOG_LEVEL || "info",
  
  // Transport pino-pretty HANYA berjalan jika bukan di production
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname", // Menyembunyikan info yang kurang penting di lokal
        },
      }
    : undefined, 
    // Di production (undefined), pino secara otomatis menulis JSON ke process.stdout
});

export default logger;