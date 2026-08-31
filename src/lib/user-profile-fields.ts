export const JOB_TITLE_MAX = 80;

/** Trim jabatan publik; kosong = undefined. */
export function normalizeJobTitle(
  raw: string | null | undefined,
): string | undefined {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return undefined;
  return trimmed.slice(0, JOB_TITLE_MAX);
}

/** Parse bidang liputan dari string koma atau array; unik (case-insensitive). */
export function parseCoverageAreas(
  raw: string | string[] | null | undefined,
): string[] {
  const parts = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function formatCoverageAreas(
  areas: string[] | undefined | null,
): string {
  return areas?.length ? areas.join(", ") : "";
}

/** Subtitle halaman `/penulis`: jabatan + bidang liputan. Null jika keduanya kosong. */
export function authorProfileSubtitle(
  jobTitle?: string | null,
  coverageAreas?: string[] | null,
): { jobTitle?: string; coverageAreas: string[] } | null {
  const title = normalizeJobTitle(jobTitle);
  const areas = parseCoverageAreas(coverageAreas);
  if (!title && areas.length === 0) return null;
  return {
    ...(title ? { jobTitle: title } : {}),
    coverageAreas: areas,
  };
}
