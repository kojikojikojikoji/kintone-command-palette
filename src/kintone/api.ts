import { KintoneRestAPIClient } from "@kintone/rest-api-client";
import { APPS_CACHE_TTL_MS, isCacheFresh, parseAppsCache } from "../core/cache";
import type { CachedApp } from "../core/cache";
import { appsCacheKey, readSession, writeSession } from "./storage";

// REST wrappers with caching (FR-4, FR-5, FR-6). Guest space is handled by
// passing guestSpaceId to the client so it builds the right paths.

const APPS_PAGE_LIMIT = 100;
const APPS_MAX_PAGES = 10; // up to 1000 apps (EC-6)
const RECORD_LIMIT = 20;

export interface AppEntry {
  appId: string;
  name: string;
}

export interface ViewEntry {
  id: string;
  name: string;
  type: string; // LIST | CALENDAR | CUSTOM
  index: number;
}

export interface AppsResult {
  apps: AppEntry[];
  truncated: boolean;
}

let clientInstance: KintoneRestAPIClient | null = null;

export function getClient(guestSpaceId: string | null): KintoneRestAPIClient {
  if (!clientInstance) {
    clientInstance = guestSpaceId
      ? new KintoneRestAPIClient({ guestSpaceId: Number(guestSpaceId) })
      : new KintoneRestAPIClient();
  }
  return clientInstance;
}

/**
 * Fetch the visible apps, paging by 100 up to 10 pages. Reads from the session
 * cache first (TTL 10 minutes) and writes the result back.
 */
export async function fetchApps(guestSpaceId: string | null, now: number): Promise<AppsResult> {
  const key = appsCacheKey();
  const cached = parseAppsCache(readSession(key));
  if (cached && isCacheFresh(cached.savedAt, now, APPS_CACHE_TTL_MS)) {
    return { apps: cached.apps, truncated: cached.truncated };
  }

  const client = getClient(guestSpaceId);
  const apps: AppEntry[] = [];
  let truncated = false;
  for (let page = 0; page < APPS_MAX_PAGES; page += 1) {
    const offset = page * APPS_PAGE_LIMIT;
    const res = await client.app.getApps({ limit: APPS_PAGE_LIMIT, offset });
    for (const app of res.apps) {
      apps.push({ appId: String(app.appId), name: app.name });
    }
    if (res.apps.length < APPS_PAGE_LIMIT) {
      break;
    }
    if (page === APPS_MAX_PAGES - 1) {
      truncated = true;
    }
  }

  const cache: { savedAt: number; truncated: boolean; apps: CachedApp[] } = {
    savedAt: now,
    truncated,
    apps,
  };
  writeSession(key, JSON.stringify(cache));
  return { apps, truncated };
}

/** Fetch the current app's views, sorted by their configured index. */
export async function fetchViews(guestSpaceId: string | null, appId: string): Promise<ViewEntry[]> {
  const client = getClient(guestSpaceId);
  const res = await client.app.getViews({ app: appId });
  const views: ViewEntry[] = Object.values(res.views).map((v) => ({
    id: String(v.id),
    name: v.name,
    type: v.type,
    index: Number(v.index),
  }));
  views.sort((a, b) => a.index - b.index);
  return views;
}

export interface RecordHit {
  id: string;
  fields: Record<string, string>;
}

/**
 * Run a like search and return `$id` plus the requested field values as plain
 * strings. `query` is built by core/query.ts.
 */
export async function searchRecords(
  guestSpaceId: string | null,
  appId: string,
  query: string,
  fields: string[],
): Promise<RecordHit[]> {
  const client = getClient(guestSpaceId);
  const res = await client.record.getRecords({
    app: appId,
    query,
    fields: ["$id", ...fields],
  });
  return res.records.slice(0, RECORD_LIMIT).map((record) => {
    const out: Record<string, string> = {};
    for (const code of fields) {
      const field = record[code] as { value?: unknown } | undefined;
      out[code] = field && field.value != null ? String(field.value) : "";
    }
    const idField = record["$id"] as { value?: unknown } | undefined;
    return { id: idField && idField.value != null ? String(idField.value) : "", fields: out };
  });
}
