/**
 * Bulk register GA4 Custom Dimensions & Custom Metrics via Admin API.
 *
 * Prasyarat:
 * 1. Enable "Google Analytics Admin API" di Google Cloud project yang dipakai auth
 * 2. Auth salah satu:
 *    - Set `GOOGLE_APPLICATION_CREDENTIALS` di .env ke path service account JSON
 *      (disarankan di Windows jika belum punya gcloud CLI)
 *    - atau `gcloud auth application-default login` (akun mp.webekspres)
 *    Service account harus ditambahkan sebagai Editor di GA4 property
 * 3. Set GA4_PROPERTY_ID di .env (angka, BUKAN G-XXXXXXXX)
 *    → GA Admin → Property settings → PROPERTY ID
 *
 * Contoh:
 *   npm run ga:register-definitions -- --env-file=.env.staging --dry-run
 *   npm run ga:register-definitions -- --env-file=.env.staging --batch=1
 *   npm run ga:register-definitions -- --env-file=.env.staging --batch=all
 *   npm run ga:register-definitions -- --list-existing --env-file=.env.staging
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { AnalyticsAdminServiceClient } from "@google-analytics/admin";
import { bootstrapEnv, scriptArgsWithoutEnvFile } from "./bootstrap-env";
import {
  filterByBatch,
  GA_CUSTOM_DIMENSIONS,
  GA_CUSTOM_METRICS,
  type GaDefinitionBatch,
} from "./ga-custom-definitions.registry";

const loadedEnvFile = bootstrapEnv();

type CliOptions = {
  batch: GaDefinitionBatch;
  dryRun: boolean;
  listExisting: boolean;
};

function parseCliOptions(argv: string[]): CliOptions {
  let batch: GaDefinitionBatch = "all";
  let dryRun = false;
  let listExisting = false;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--list-existing") listExisting = true;
    else if (arg.startsWith("--credentials=")) {
      const credPath = resolve(process.cwd(), arg.slice("--credentials=".length));
      if (!existsSync(credPath)) {
        console.error(`File credentials tidak ditemukan: ${credPath}`);
        process.exit(1);
      }
      process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
    } else if (arg.startsWith("--batch=")) {
      const value = arg.slice("--batch=".length) as GaDefinitionBatch;
      if (!["1", "2", "3", "all"].includes(value)) {
        console.error(`Batch tidak valid: ${value}. Pakai 1, 2, 3, atau all.`);
        process.exit(1);
      }
      batch = value;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Argumen tidak dikenal: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  return { batch, dryRun, listExisting };
}

function printHelp(): void {
  console.log(`
Bulk register GA4 custom definitions (dimensions + metrics)

Usage:
  npm run ga:register-definitions -- [options]

Options:
  --env-file=.env.staging   File env (via bootstrap-env)
  --batch=1|2|3|all         Batch definisi (default: all)
  --dry-run                 Tampilkan rencana tanpa API call create
  --list-existing           List definisi yang sudah ada di property
  --credentials=PATH        Path ke service account JSON (alternatif env)
  --help                    Bantuan ini

Env:
  GA4_PROPERTY_ID                  Numeric property ID (wajib)
  GOOGLE_APPLICATION_CREDENTIALS   Path ke service account JSON (wajib untuk API)
`);
}

function ensureGoogleCredentials(): void {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (credPath) {
    const resolved = resolve(process.cwd(), credPath);
    if (!existsSync(resolved)) {
      console.error(`GOOGLE_APPLICATION_CREDENTIALS tidak ditemukan: ${resolved}`);
      process.exit(1);
    }
    process.env.GOOGLE_APPLICATION_CREDENTIALS = resolved;
    return;
  }

  console.error(`
Kredensial Google belum dikonfigurasi (NO_ADC_FOUND).

Pilih salah satu:

【Opsi A — Service account JSON】 (disarankan di Windows)

  1. Google Cloud Console → APIs → enable "Google Analytics Admin API"
  2. IAM → Service Accounts → Create → download JSON key
  3. GA4 Admin → Property access management → tambah email service account sebagai Editor
  4. Tambahkan di .env.staging:
       GOOGLE_APPLICATION_CREDENTIALS=./secrets/ga-admin-sa.json
     atau jalankan:
       npm run ga:register-definitions -- --credentials=./secrets/ga-admin-sa.json ...

【Opsi B — gcloud CLI】

  1. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
  2. gcloud auth application-default login
     (login dengan mp.webekspres@gmail.com)
  3. Jalankan script lagi
`);
  process.exit(1);
}

function isNoCredentialsError(err: unknown): boolean {
  const message = String((err as Error)?.message ?? err);
  return /NO_ADC_FOUND|Could not load the default credentials/i.test(message);
}

function getPropertyId(): string {
  const raw = process.env.GA4_PROPERTY_ID?.trim();
  if (!raw) {
    console.error(
      "GA4_PROPERTY_ID belum di-set. Isi di .env — angka dari GA Admin → Property settings.",
    );
    process.exit(1);
  }
  if (!/^\d+$/.test(raw)) {
    console.error(
      `GA4_PROPERTY_ID harus angka (contoh: 123456789), bukan measurement ID G-xxx. Diterima: ${raw}`,
    );
    process.exit(1);
  }
  return raw;
}

function isAlreadyExistsError(err: unknown): boolean {
  const code = (err as { code?: number })?.code;
  const message = String((err as Error)?.message ?? err);
  return code === 6 || /already exists/i.test(message);
}

async function listExistingDefinitions(propertyId: string): Promise<void> {
  const client = new AnalyticsAdminServiceClient();
  const parent = `properties/${propertyId}`;

  console.log(`\nProperty: ${parent} (env: ${loadedEnvFile})\n`);

  const [dimensions] = await client.listCustomDimensions({ parent });
  console.log(`Custom dimensions (${dimensions.length}):`);
  for (const dim of dimensions) {
    console.log(
      `  - ${dim.displayName} | parameter=${dim.parameterName} | scope=${dim.scope}`,
    );
  }

  const [metrics] = await client.listCustomMetrics({ parent });
  console.log(`\nCustom metrics (${metrics.length}):`);
  for (const metric of metrics) {
    console.log(
      `  - ${metric.displayName} | parameter=${metric.parameterName} | scope=${metric.scope}`,
    );
  }
}

async function registerDefinitions(
  propertyId: string,
  options: CliOptions,
): Promise<void> {
  const client = new AnalyticsAdminServiceClient();
  const parent = `properties/${propertyId}`;

  const dimensions = filterByBatch(GA_CUSTOM_DIMENSIONS, options.batch);
  const metrics = filterByBatch(GA_CUSTOM_METRICS, options.batch);

  console.log(`\nProperty: ${parent}`);
  console.log(`Env file: ${loadedEnvFile}`);
  console.log(`Batch: ${options.batch}`);
  console.log(`Dry run: ${options.dryRun ? "yes" : "no"}`);
  console.log(
    `Akan memproses ${dimensions.length} dimension(s) + ${metrics.length} metric(s)\n`,
  );

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const dim of dimensions) {
    const label = `dimension ${dim.parameterName}`;
    if (options.dryRun) {
      console.log(`[dry-run] CREATE ${label} → "${dim.displayName}"`);
      continue;
    }

    try {
      await client.createCustomDimension({
        parent,
        customDimension: {
          parameterName: dim.parameterName,
          displayName: dim.displayName,
          scope: "EVENT",
        },
      });
      console.log(`✓ created ${label}`);
      created++;
    } catch (err) {
      if (isAlreadyExistsError(err)) {
        console.log(`○ skip ${label} (sudah ada)`);
        skipped++;
      } else {
        console.error(`✗ gagal ${label}:`, err);
        failed++;
      }
    }
  }

  for (const metric of metrics) {
    const label = `metric ${metric.parameterName}`;
    if (options.dryRun) {
      console.log(`[dry-run] CREATE ${label} → "${metric.displayName}"`);
      continue;
    }

    try {
      await client.createCustomMetric({
        parent,
        customMetric: {
          parameterName: metric.parameterName,
          displayName: metric.displayName,
          scope: "EVENT",
          measurementUnit: "STANDARD",
        },
      });
      console.log(`✓ created ${label}`);
      created++;
    } catch (err) {
      if (isAlreadyExistsError(err)) {
        console.log(`○ skip ${label} (sudah ada)`);
        skipped++;
      } else {
        console.error(`✗ gagal ${label}:`, err);
        failed++;
      }
    }
  }

  if (!options.dryRun) {
    console.log(
      `\nSelesai. created=${created}, skipped=${skipped}, failed=${failed}`,
    );
    if (failed > 0) process.exit(1);
  }
}

async function main(): Promise<void> {
  const options = parseCliOptions(scriptArgsWithoutEnvFile());
  const propertyId = getPropertyId();

  if (!options.dryRun) {
    ensureGoogleCredentials();
  }

  try {
    if (options.listExisting) {
      await listExistingDefinitions(propertyId);
      return;
    }

    await registerDefinitions(propertyId, options);
  } catch (err) {
    if (isNoCredentialsError(err)) {
      ensureGoogleCredentials();
    }
    throw err;
  }
}

main().catch((err) => {
  if (isNoCredentialsError(err)) {
    process.exit(1);
  }
  console.error("Fatal:", err);
  process.exit(1);
});
