import { z } from "zod";

// Session cache TTL logic for the app list (FR-4). kintone independent.

export const APPS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** True while the cache is within its TTL from `savedAt` at time `now`. */
export function isCacheFresh(
  savedAt: number,
  now: number,
  ttlMs: number = APPS_CACHE_TTL_MS,
): boolean {
  return now - savedAt < ttlMs;
}

const cachedAppSchema = z.object({
  appId: z.string(),
  name: z.string(),
});

const appsCacheSchema = z.object({
  savedAt: z.number(),
  truncated: z.boolean(),
  apps: z.array(cachedAppSchema),
});

export type CachedApp = z.infer<typeof cachedAppSchema>;
export type AppsCache = z.infer<typeof appsCacheSchema>;

/** Parse the stored apps cache. Returns null on any failure (caller re-fetches). */
export function parseAppsCache(raw: string | null | undefined): AppsCache | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = appsCacheSchema.safeParse(data);
  return result.success ? result.data : null;
}
