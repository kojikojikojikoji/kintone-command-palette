import { z } from "zod";
import type { RecentItem } from "./types";

// Recent items history logic (FR-9). Storage I/O is injected; this file only
// transforms arrays and validates parsed JSON.

export const RECENT_MAX = 20;

const recentItemSchema = z.object({
  type: z.string(),
  id: z.string(),
  label: z.string(),
  subLabel: z.string(),
  url: z.string(),
  lastUsedAt: z.number(),
});

const recentListSchema = z.array(recentItemSchema);

/**
 * Add an item to the front of the history, removing any existing entry with the
 * same type+id (dedupe) and capping the list at RECENT_MAX.
 */
export function addRecent(
  list: readonly RecentItem[],
  item: Omit<RecentItem, "lastUsedAt">,
  now: number,
  max: number = RECENT_MAX,
): RecentItem[] {
  const withoutDup = list.filter((r) => !(r.type === item.type && r.id === item.id));
  const next: RecentItem[] = [{ ...item, lastUsedAt: now }, ...withoutDup];
  return next.slice(0, max);
}

/** Parse stored history JSON. Returns an empty list on any failure. */
export function parseRecent(raw: string | null | undefined): RecentItem[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const result = recentListSchema.safeParse(data);
  return result.success ? result.data : [];
}
