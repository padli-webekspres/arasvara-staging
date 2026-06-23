import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** Load .env atau file dari flag `--env-file=...`. */
export function bootstrapEnv(): string {
  const envArg = process.argv
    .slice(2)
    .find((arg) => arg.startsWith("--env-file="));

  const envFile =
    envArg?.slice("--env-file=".length) ??
    process.env.DOTENV_CONFIG_PATH ??
    ".env";

  const envPath = resolve(process.cwd(), envFile);

  if (!existsSync(envPath)) {
    console.error(`Env file tidak ditemukan: ${envPath}`);
    process.exit(1);
  }

  const result = config({ path: envPath, quiet: true });
  if (result.error) {
    console.error(`Gagal load env dari ${envPath}:`, result.error);
    process.exit(1);
  }

  return envFile;
}

/** Argumen CLI tanpa `--env-file=...`. */
export function scriptArgsWithoutEnvFile(): string[] {
  return process.argv.slice(2).filter((arg) => !arg.startsWith("--env-file="));
}
