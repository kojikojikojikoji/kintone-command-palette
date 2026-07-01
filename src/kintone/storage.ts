import { parseRecent, addRecent } from "../core/recent";
import type { RecentItem } from "../core/types";

// Browser storage wrappers. All access is wrapped in try/catch so a blocked
// storage (private mode, quota) disables only the affected feature and never
// breaks the palette (EC-16, FR-9).

function currentDomain(): string {
  return location.hostname;
}

function userCode(): string {
  try {
    return kintone.getLoginUser().code;
  } catch {
    return "unknown";
  }
}

// --- Recent items (localStorage) -------------------------------------------

function recentKey(appId: string): string {
  return `kp-cmdp-recent-${currentDomain()}-${appId}-${userCode()}`;
}

export function loadRecent(appId: string): RecentItem[] {
  try {
    return parseRecent(localStorage.getItem(recentKey(appId)));
  } catch {
    return [];
  }
}

export function pushRecent(appId: string, item: Omit<RecentItem, "lastUsedAt">, now: number): void {
  try {
    const next = addRecent(loadRecent(appId), item, now);
    localStorage.setItem(recentKey(appId), JSON.stringify(next));
  } catch {
    // History write disabled; the palette keeps working.
  }
}

// --- Apps cache (sessionStorage) -------------------------------------------

export function appsCacheKey(): string {
  return `kp-cmdp-apps-${currentDomain()}-${userCode()}`;
}

export function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Cache write disabled; the palette re-fetches next time.
  }
}
