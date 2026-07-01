import { describe, expect, it } from "vitest";
import { APPS_CACHE_TTL_MS, isCacheFresh, parseAppsCache } from "../../src/core/cache";

const MIN = 60 * 1000;

describe("isCacheFresh", () => {
  it("TC-15: 9 minutes old is fresh, 11 minutes old is stale (TTL 10 min)", () => {
    const now = 100 * MIN;
    expect(isCacheFresh(now - 9 * MIN, now)).toBe(true);
    expect(isCacheFresh(now - 11 * MIN, now)).toBe(false);
  });

  it("uses the default 10 minute TTL", () => {
    expect(APPS_CACHE_TTL_MS).toBe(10 * MIN);
  });
});

describe("parseAppsCache", () => {
  it("returns null for missing or invalid data", () => {
    expect(parseAppsCache(null)).toBeNull();
    expect(parseAppsCache("{bad")).toBeNull();
    expect(parseAppsCache(JSON.stringify({ savedAt: "x" }))).toBeNull();
  });

  it("parses a valid cache", () => {
    const cache = { savedAt: 123, truncated: false, apps: [{ appId: "1", name: "A" }] };
    expect(parseAppsCache(JSON.stringify(cache))).toEqual(cache);
  });
});
