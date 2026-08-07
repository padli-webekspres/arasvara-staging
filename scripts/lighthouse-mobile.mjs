/**
 * Jalankan Lighthouse mobile memakai URL dari env:
 *   LIGHTHOUSE_URL           — override eksplisit
 *   NEXT_PUBLIC_BASE_URL     — dari .env (base URL lokal/LAN/production)
 *   fallback                 — https://arasvara.id
 *
 * Contoh:
 *   npm run lighthouse:mobile
 *   LIGHTHOUSE_URL=https://arasvara.id npm run lighthouse:mobile
 *   CHROME_PATH=/usr/bin/brave-browser npm run lighthouse:mobile
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Jangan override env yang sudah di-set di shell
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));

const url = (
  process.env.LIGHTHOUSE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "https://arasvara.id"
).replace(/\/$/, "");

console.log(`Lighthouse mobile → ${url}`);

const args = [
  url,
  "--form-factor=mobile",
  "--throttling.cpuSlowdownMultiplier=4",
  "--only-categories=performance,accessibility",
  "--output=html",
  "--output-path=./lighthouse-mobile-report.html",
  "--view",
];

const result = spawnSync("npx", ["lighthouse", ...args], {
  stdio: "inherit",
  env: process.env,
  shell: false,
});

process.exit(result.status ?? 1);
